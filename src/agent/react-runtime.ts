import { ToolRegistry } from "./tools";
import { buildSystemPrompt } from "./prompt-builder";
import { ToolExecutor } from "./tool-executor";
import { ConversationMemory } from "./memory";
import { ContextManager } from "./context-manager";

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface ModelClient {
    chat: (messages: Message[], signal?: AbortSignal) => Promise<string>;
}

export type ParseResult =
    | { type: "tool_call"; thought: string; toolName: string; args: Record<string, unknown> }
    | { type: "final_answer"; content: string }
    | { type: "parse_error"; rawOutput: string; reason: string };

export default async function runReActLoop(
    msg: string,
    registry: ToolRegistry,
    executor: ToolExecutor,
    model: ModelClient,
    externalCtx?: ContextManager,
    signal?: AbortSignal,
    onToolCall?: (event: { step: number; toolName: string; args: Record<string, unknown>; observation?: string }) => void,
): Promise<string> {
    // 1. 组装 system prompt
    const systemPrompt = buildSystemPrompt(registry);
    // 2. 初始化消息列表
    const memory = new ConversationMemory(systemPrompt, msg);
    // 3. 初始化上下文管理器
    const ctxManager = externalCtx ?? new ContextManager(model, 1, 1);

    let stepCount = 0;
    const maxSteps = 10;
    let parseFailCount = 0;
    const maxRetries = 2;
    while (stepCount < maxSteps) {
        stepCount++;
        if (signal?.aborted) throw new Error("用户中断");
        const rawMessages = memory.getAllMessages();
        const messages = await ctxManager.build(rawMessages);
        const result = await model.chat(messages, signal);
        memory.add({
            role: "assistant",
            content: result
        });

        // 解析模型输出，判断意图
        const parsed = parseModelOutput(result, registry);

        if (parsed.type === "final_answer") {
            return parsed.content;
        }

        if (parsed.type === "tool_call") {
            parseFailCount = 0;
            // 执行前通知前端：Agent 正在做什么
            onToolCall?.({ step: stepCount, toolName: parsed.toolName, args: parsed.args });
            // 让出控制权，确保浏览器先渲染「执行中」状态
            await new Promise<void>(r => setTimeout(r, 0));
            const toolResult = await executor.execute(parsed.toolName, parsed.args);
            // 执行后通知前端：工具执行结果
            onToolCall?.({ step: stepCount, toolName: parsed.toolName, args: parsed.args, observation: toolResult.content });
            memory.add({
                role: "user",
                content: `Observation: ${toolResult.content}`,
            });
            continue;
        }

        if (parsed.type === "parse_error") {
            parseFailCount++;
            if (parseFailCount > maxRetries) {
                return `Agent 解析失败：模型连续 ${maxRetries} 次未按格式输出。`;
            }
            memory.add({
                role: "user",
                content: `你的输出格式不正确（${parsed.reason}）。请严格按以下格式重新输出：
<tool_call>{"name": "工具名", "arguments": {...}}</tool_call>
或者：Final Answer: 你的回答`,
            });
            continue;
        }
    }
    memory.add({
        role: "user",
        content: "已达到最大步数限制。请基于目前已有的 Observation 信息，给出你能提供的最佳回答。如果信息不足，请明确指出缺少什么。",
    });
    // 步数超长，兜底
    const rawMessages = memory.getAllMessages();
    const finalMessages = await ctxManager.build(rawMessages);
    const finalResult = await model.chat(finalMessages);
    return finalResult;
}

export function parseModelOutput(raw: string, registry: ToolRegistry): ParseResult {
    // 用字符串定位 <tool_call>...</tool_call>，避免正则 \{[\s\S]*?\} 被代码中的 {} 干扰
    const tcStart = raw.indexOf("<tool_call>");
    const tcEnd = raw.indexOf("</tool_call>");
    const hasToolCall = tcStart !== -1 && tcEnd !== -1 && tcEnd > tcStart;

    if (hasToolCall) {
        const thoughtMatch = raw.match(/Thought\s*:\s*([\s\S]+?)(?=<tool_call>|$)/i);
        const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

        const jsonStr = raw.slice(tcStart + "<tool_call>".length, tcEnd).trim();
        try {
            const parsed = JSON.parse(jsonStr);
            const toolName: string = parsed.name;
            const args: Record<string, unknown> = parsed.arguments ?? {};

            if (!registry.get(toolName)) {
                return {
                    type: "parse_error",
                    rawOutput: raw,
                    reason: `未知工具 "${toolName}"`,
                };
            }

            return { type: "tool_call", thought, toolName, args };
        } catch (e) {
            return {
                type: "parse_error",
                rawOutput: raw,
                reason: `JSON 解析失败：${(e as Error).message}`,
            };
        }
    }

    // 2. 尝试匹配 Final Answer
    const faMatch = raw.match(/Final\s+Answer\s*:\s*([\s\S]*)/i);
    if (faMatch) {
        return { type: "final_answer", content: faMatch[1].trim() };
    }

    // 3. 什么都没匹配到 → 兜底当 final_answer 处理
    return { type: "final_answer", content: raw };
}