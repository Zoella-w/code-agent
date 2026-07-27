import { ToolRegistry } from "./tools";
import type { Message, ModelClient } from "./react-runtime";
import { parseModelOutput } from "./react-runtime";
import { buildSystemPrompt } from "./prompt-builder";
import { ToolExecutor } from "./tool-executor";

// 单步执行结果
interface StepResult {
    step: number;
    description: string;
    result: string;
}

// 拼装 Planning 阶段的 System Prompt，让 LLM 输出 JSON 计划
function buildPlanningPrompt(task: string, registry: ToolRegistry): string {
    const roleLine = "你是一个任务规划器。分析用户任务，拆成 3-5 个执行步骤。只输出计划，不执行。";
    const toolsSection = "## 可用工具\n" + registry.getAllSchemas();
    const formatSection = [
        "## 输出格式",
        "严格输出一个 JSON 对象，不要加任何解释或代码块包裹：",
        '{',
        '  "plan": [',
        '    "步骤1描述",',
        '    "步骤2描述",',
        '    "步骤3描述"',
        '  ]',
        '}',
    ].join("\n");
    const rules = "每个步骤描述包含：做什么 + 用哪个工具 + 期望获得什么信息。";
    return [roleLine, toolsSection, formatSection, rules].join("\n\n");
}

// 调 LLM 生成执行计划，返回步骤描述数组，解析失败返回 []
async function generatePlan(
    task: string,
    registry: ToolRegistry,
    model: ModelClient,
    signal?: AbortSignal,
): Promise<string[]> {
    const systemPrompt = buildPlanningPrompt(task, registry);
    const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: task },
    ];

    const raw = await model.chat(messages, signal);
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
    }
    // 拿到 plan 字段
    try {
        const parsed = JSON.parse(jsonStr);
        return parsed.plan ?? [];
    } catch {
        return [];
    }
}

// Plan & Execute 主入口：Planning → Execution → Summarization
export default async function planAndExecute(
    task: string,
    registry: ToolRegistry,
    executor: ToolExecutor,
    model: ModelClient,
    signal?: AbortSignal,
    onToolCall?: (event: { step: number; toolName: string; args: Record<string, unknown>; observation?: string }) => void,
): Promise<string> {
    // Phase 1: Planning — 生成步骤列表
    const plan: string[] = await generatePlan(task, registry, model, signal);
    if (plan.length === 0) {
        return "计划生成失败，请重试。";
    }

    // Phase 2: Execution — 逐步执行
    const stepResults: StepResult[] = [];
    for (let i = 0; i < plan.length; i++) {
        if (signal?.aborted) throw new Error("用户中断");
        const result = await executeStep(
            plan[i],       // 当前步骤
            i + 1,         // 步骤编号
            task,          // 原始任务（提醒 LLM 不丢失全局目标）
            stepResults,   // 前面步骤的结果
            registry,
            executor,
            model,
            signal,
            onToolCall,
        );
        stepResults.push(result);
    }

    // Phase 3: Summarization — 汇总所有步骤结果
    const finalAnswer = await summarize(task, stepResults, model, signal);
    return finalAnswer;
}

// 执行计划中的单个步骤，内部是迷你 ReAct 循环
async function executeStep(
    stepDescription: string,
    stepNumber: number,
    task: string,
    previousResults: StepResult[],
    registry: ToolRegistry,
    executor: ToolExecutor,
    model: ModelClient,
    signal?: AbortSignal,
    onToolCall?: (event: { step: number; toolName: string; args: Record<string, unknown>; observation?: string }) => void,
): Promise<StepResult> {
    // 拼装 system prompt：工具列表 + 当前步骤上下文（包含前面步骤上下文）
    const prevText = previousResults.length > 0
        ? "前面步骤结果：\n" + previousResults.map(r => `步骤${r.step}：${r.result}`).join("\n")
        : "这是第一个步骤。";
    const stepContext = [
        `你正在执行一个计划中的第 ${stepNumber} 步。`,
        `原始任务：${task}`,
        prevText,
        `当前步骤：${stepDescription}`,
        `完成后请用 Final Answer 输出这一步的结果。`,
    ].join("\n");

    const messages: Message[] = [
        { role: "system", content: buildSystemPrompt(registry) + "\n\n" + stepContext },
        { role: "user", content: `请执行：${stepDescription}` },
    ];

    let stepCount = 0;
    const maxSteps = 5;
    // 迷你 ReAct 循环：每步调 LLM → 解析意图 → 调工具或给结果
    while (stepCount < maxSteps) {
        stepCount++;
        if (signal?.aborted) throw new Error("用户中断");
        const raw = await model.chat(messages, signal);
        messages.push({ role: "assistant", content: raw });
        // 解析 LLM 输出，判断类型：tool_call / final_answer / parse_error
        const parsed = parseModelOutput(raw, registry);
        if (parsed.type === "final_answer") {
            return {
                step: stepNumber,
                description: stepDescription,
                result: parsed.content,
            };
        }
        if (parsed.type === "tool_call") {
            onToolCall?.({ step: stepCount, toolName: parsed.toolName, args: parsed.args });
            await new Promise<void>(r => setTimeout(r, 0));
            const toolResult = await executor.execute(parsed.toolName, parsed.args);
            onToolCall?.({ step: stepCount, toolName: parsed.toolName, args: parsed.args, observation: toolResult.content });
            messages.push({
                role: "user",
                content: `Observation: ${toolResult.content}`,
            });
            continue;
        }
        if (parsed.type === "parse_error") {
            messages.push({
                role: "user",
                content: `输出格式错误（${parsed.reason}）。请用 <tool_call>{"name":"...","arguments":{...}}</tool_call> 调工具，或用 Final Answer: ...给出结果。`,
            });
            continue;
        }
    }
    // 达到最大步数，强制让 LLM 给出总结
    messages.push({
        role: "user",
        content: "已达到最大步数。请基于已有的 Observation 信息，用 Final Answer 给出这一步的当前结果。",
    });
    const forced = await model.chat(messages, signal);
    return {
        step: stepNumber,
        description: stepDescription,
        result: forced,
    };
}

// 汇总所有步骤结果，生成最终回答
async function summarize(
    task: string,
    stepResults: StepResult[],
    model: ModelClient,
    signal?: AbortSignal,
): Promise<string> {
    // 将各步骤结果拼成 LLM 可读的文本
    const resultsText = stepResults
        .map(r => `步骤${r.step}：${r.description}\n结果：${r.result}`)
        .join("\n\n");

    const systemPrompt = [
        "你是一个结果汇总器。基于以下步骤执行结果，对原始任务给出完整回答。",
        `原始任务：${task}`,
        "执行结果：",
        resultsText,
    ].join("\n");

    const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "请基于以上执行结果，对原始任务给出最终回答。" },
    ];
    return await model.chat(messages, signal);
}