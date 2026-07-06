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
    chat: (messages: Message[]) => Promise<string>;
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
        const rawMessages = memory.getAllMessages();
        const messages = await ctxManager.build(rawMessages);
        const result = await model.chat(messages);
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
            const toolResult = await executor.execute(parsed.toolName, parsed.args);
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
    // 1. 尝试匹配 <tool_call>...</tool_call>
    const tcMatch = raw.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/);

    if (tcMatch) {
        // 提取 Thought（可选）
        const thoughtMatch = raw.match(/Thought\s*:\s*([\s\S]+?)(?=<tool_call>|$)/i);
        const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

        // 尝试 JSON.parse
        let jsonStr = tcMatch[1].trim();
        try {
            const parsed = JSON.parse(jsonStr);
            const toolName: string = parsed.name;
            const args: Record<string, unknown> = parsed.arguments ?? {};

            // 校验工具是否存在
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