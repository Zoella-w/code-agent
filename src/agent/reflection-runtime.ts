import { ToolRegistry } from "./tools";
import { buildSystemPrompt } from "./prompt-builder";
import { parseModelOutput } from "./react-runtime";
import type { Message, ModelClient } from "./react-runtime";
import { ToolExecutor } from "./tool-executor";

// 带反思上下文的 Actor，本质是一次 ReAct 循环
async function runActor(
    task: string,
    registry: ToolRegistry,
    executor: ToolExecutor,
    model: ModelClient,
    reflection: string,
): Promise<{ answer: string; messages: Message[] }> {
    let systemPrompt = buildSystemPrompt(registry);
    if (reflection) {
        systemPrompt += [
            "",
            "## 上一轮反思",
            reflection,
            "",
            "请基于以上反思改进你的执行策略，避免重复上次的错误。",
        ].join("\n");
    }

    const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: task },
    ];
    let stepCount = 0;
    const maxSteps = 10;
    while (stepCount < maxSteps) {
        stepCount++;
        const raw = await model.chat(messages);
        messages.push({ role: "assistant", content: raw });

        // 解析 LLM 输出：判断是调工具还是给最终回答
        const parsed = parseModelOutput(raw, registry);
        if (parsed.type === "final_answer") {
            return { answer: parsed.content, messages };
        }
        if (parsed.type === "tool_call") {
            const toolResult = await executor.execute(parsed.toolName, parsed.args);
            messages.push({
                role: "user",
                content: `Observation: ${toolResult.content}`,
            });
            continue;
        }
        if (parsed.type === "parse_error") {
            messages.push({
                role: "user",
                content: `输出格式错误（${parsed.reason}）。请用 <tool_call>{"name":"...","arguments":{...}}</tool_call> 调工具，或用 Final Answer: 给出结果。`,
            });
            continue;
        }
    }
    // 达到最大步数，强制 LLM 给出最终回答
    messages.push({
        role: "user",
        content: "已达到最大步数。请基于已有的 Observation 信息，用 Final Answer 给出你的回答。",
    });
    const forced = await model.chat(messages);
    messages.push({ role: "assistant", content: forced });
    return { answer: forced, messages };
}

// 评估 Actor 的回答是否满足任务要求
async function evaluateResult(
    task: string,
    answer: string,
    model: ModelClient,
): Promise<{ passed: boolean }> {
    const systemPrompt = [
        "你是一个严格的评估器。对照原始任务，判断以下回答是否完整、准确。",
        "如果回答完全满足任务要求，只输出 PASS。",
        "如果回答有任何遗漏、错误、不准确的地方，只输出 FAIL。",
        "不要输出任何其他文字。",
    ].join("\n");

    const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `原始任务：${task}\n\n待评估回答：${answer}` },
    ];

    const raw = await model.chat(messages);
    const passed = raw.trim().toUpperCase().includes("PASS");

    return { passed };
}

// 基于 Actor 的执行过程和回答，生成改进建议
async function generateReflection(
    task: string,
    answer: string,
    messages: Message[],
    model: ModelClient,
): Promise<string> {
    const systemPrompt = [
        "你是一个反思分析师。你的任务是分析 Actor 的执行过程，找出导致回答不满足要求的根本原因。",
        "输出一段具体的改进建议，Actor 会在下一轮执行中参考这些建议。",
        "要具体：指出遗漏了什么、搜索/读取策略有什么缺陷、下一步应如何调整。",
        "不要泛泛而谈，不要说'应该更仔细'，要说'应该同时搜索 X 和 Y 两个关键词，因为...'。",
    ].join("\n");

    // 将执行过程格式化为文本
    const traceText = messages
        .filter(m => m.role !== "system")
        .map(m => `[${m.role}]: ${m.content}`)
        .join("\n\n");
    const userContent = [
        `原始任务：${task}`,
        `Actor 的最终回答：${answer}`,
        "Actor 的完整执行过程：",
        traceText,
        "请分析上述执行过程，给出改进建议。",
    ].join("\n\n");

    const chatMessages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
    ];
    const raw = await model.chat(chatMessages);
    return raw.trim();
}

// Reflection 主入口：Actor 执行 → Evaluate → Reflect → 循环直到满意
export default async function reflectAndExecute(
    task: string,
    registry: ToolRegistry,
    executor: ToolExecutor,
    model: ModelClient,
): Promise<{ answer: string; rounds: number }> {
    let reflection = "";  // 上一轮的反思文本，首轮为空
    let round = 0;
    const maxRounds = 3;

    let lastAnswer = "";  // 记录最后一轮 answer，兜底用
    while (round < maxRounds) {
        round++;
        // 1. Actor 执行，拿结果和对话历史
        const { answer, messages } = await runActor(task, registry, executor, model, reflection);
        lastAnswer = answer;

        // 2. Evaluator 评估：合格就直接返回
        const { passed } = await evaluateResult(task, answer, model);
        if (passed) {
            return { answer, rounds: round };
        }
        // 3. 不合格 → Reflector 反思，下一轮 Actor 会注入 System Prompt
        reflection = await generateReflection(task, answer, messages, model);
    }
    // 反思优化达到最大轮数，但仍未满意，返回最后一次答案
    return { answer: lastAnswer, rounds: maxRounds };
}