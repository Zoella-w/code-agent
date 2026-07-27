import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ToolRegistry } from "@/agent/tools";
import { readFileTool, searchCodeTool, listDirectoryTool, writeFileTool, analyzeCodeTool } from "@/agent/tool-defs";
import { ToolExecutor } from "@/agent/tool-executor";
import { registerExecutor, removeExecutor } from "@/agent/executor-store";
import { ConversationMemory } from "@/agent/memory";
import { AnthropicModelClient, StreamingModelClient } from "@/agent/model-client";
import { ContextManager } from "@/agent/context-manager";

type SSEEvent =
    | { type: "delta"; text: string }
    | { type: "step"; step: number; toolName: string; args: Record<string, unknown>; observation?: string }
    | { type: "approval_required"; runId: string; toolName: string; args: Record<string, unknown> };

function sendSSE(controller: ReadableStreamDefaultController, event: SSEEvent) {
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

function registryToTools(registry: ToolRegistry): Anthropic.Tool[] {
    const tools: Anthropic.Tool[] = [];
    for (const name of registry.getAllNames()) {
        const tool = registry.get(name);
        if (!tool) continue;
        const props: Record<string, { type: string; description: string }> = {};
        for (const [key, def] of Object.entries(tool.schema.parameters)) {
            props[key] = { type: def.type, description: def.description };
        }
        tools.push({
            name: tool.schema.name,
            description: tool.schema.description,
            input_schema: { type: "object" as const, properties: props, required: tool.schema.required },
        });
    }
    return tools;
}

const SYSTEM_PROMPT = `你是一个代码审查专家。你需要使用工具读取代码后给出审查意见。

规则：
1. 先用工具读取用户指定的文件，再基于真实代码回答
2. 回答必须简洁，用列表形式逐条列出问题，每条不超过2句话
3. 禁止输出"首先"、"接下来"等过渡词，禁止大段描述
4. 格式：先说明文件概况（一句话），然后"发现问题：\n1. xxx\n2. xxx"
5. 如果代码没有明显问题，直接说"未发现明显问题"并简要说明原因`;

export async function POST(request: NextRequest) {
    const { prompt } = await request.json();

    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(searchCodeTool);
    registry.register(listDirectoryTool);
    registry.register(writeFileTool);
    registry.register(analyzeCodeTool);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const executor = new ToolExecutor(registry);
    executor.approvalPolicy = "ask";
    const tools = registryToTools(registry);
    const memory = new ConversationMemory(SYSTEM_PROMPT, prompt);
    const ctxManager = new ContextManager(new AnthropicModelClient(), 3, 3);

    const stream = new ReadableStream({
        async start(controller) {
            // 审批回调注入到 executor（controller 在 start 内才可用）
            executor.onApprovalRequired = (req) => {
                sendSSE(controller, { type: "approval_required", runId: req.runId, toolName: req.toolName, args: req.args });
            };
            registerExecutor(runId, executor);
            let stepCount = 0;
            const maxSteps = 8;

            try {
                while (stepCount < maxSteps) {
                    stepCount++;

                    const rawMessages = memory.getAllMessages();
                    const messages = await ctxManager.build(rawMessages);
                    const systemMsg = messages.find((m) => m.role === "system");
                    const chatMessages = messages
                        .filter((m) => m.role === "user" || m.role === "assistant")
                        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

                    // 流式/非流式统一调用（Claude 流式、DeepSeek 非流式，由 StreamingModelClient 内部抹平差异）
                    const streamingClient = new StreamingModelClient();
                    let fullText = "";
                    let wasStreamed = false;
                    const toolCalls: { name: string; input: Record<string, unknown> }[] = [];

                    for await (const event of streamingClient.streamChat(
                        systemMsg?.content,
                        chatMessages,
                        tools,
                    )) {
                        if (event.type === "text_delta") {
                            // Claude 流式：token 逐个到达，实时推给前端
                            sendSSE(controller, { type: "delta", text: event.text });
                            fullText += event.text;
                            wasStreamed = true;
                        } else if (event.type === "text_done") {
                            // DeepSeek 非流式：文本一次性到达，先记录，循环结束后发送
                            fullText = event.text;
                        } else if (event.type === "tool_use") {
                            toolCalls.push({ name: event.name, input: event.input });
                        }
                    }

                    memory.add({ role: "assistant", content: fullText || "(tool call)" });

                    if (toolCalls.length > 0) {
                        for (const tc of toolCalls) {
                            if (!registry.get(tc.name)) continue;

                            try {
                                const result = await executor.execute(
                                    tc.name,
                                    tc.input as Record<string, unknown>,
                                    30000,
                                    runId
                                );
                                sendSSE(controller, {
                                    type: "step",
                                    step: stepCount,
                                    toolName: tc.name,
                                    args: tc.input as Record<string, unknown>,
                                    observation: result.content.slice(0, 500),
                                });
                                memory.add({
                                    role: "user",
                                    content: `工具 ${tc.name} 返回：${result.content}`,
                                });
                            } catch (toolErr) {
                                memory.add({
                                    role: "user",
                                    content: `工具 ${tc.name} 执行失败：${(toolErr as Error).message}`,
                                });
                            }
                        }
                        continue;
                    }

                    if (fullText && !wasStreamed) {
                        // 仅 DeepSeek 非流式路径：文本尚未发送，在此处发送
                        sendSSE(controller, { type: "delta", text: fullText });
                    }
                    return;
                }

                // maxSteps 耗尽，最后一次无工具调用
                const rawMessages = memory.getAllMessages();
                const messages = await ctxManager.build(rawMessages);
                const systemMsg = messages.find((m) => m.role === "system");
                const chatMessages = messages
                    .filter((m) => m.role === "user" || m.role === "assistant")
                    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

                const finalClient = new AnthropicModelClient();
                const answer = await finalClient.chat([
                    ...(systemMsg ? [{ role: "system" as const, content: `${systemMsg.content}\n\n不要再调工具了，直接给出最终审查结论。` }] : []),
                    ...chatMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
                ]);
                sendSSE(controller, { type: "delta", text: answer || "分析完成，但未能生成结论。" });
            } catch (err) {
                sendSSE(controller, { type: "delta", text: `错误：${(err as Error).message}` });
            } finally {
                removeExecutor(runId);
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
