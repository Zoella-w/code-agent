import Anthropic from "@anthropic-ai/sdk";

// ── 类型定义 ──────────────────────────────────────────────

/** 模型提供商（参考 pico 多后端架构） */
export type ModelProvider = "deepseek" | "claude";

/** 模型配置，由环境变量驱动 */
export interface ModelConfig {
    provider: ModelProvider;
    apiKey: string;
    model: string;
    baseURL: string;
}

export interface Message {
    role: "system" | "user" | "assistant";
    content: string;
}

/** 非流式 agent 运行时接口（react-runtime / plan-execute / reflection） */
export interface ModelClient {
    chat: (messages: Message[], signal?: AbortSignal) => Promise<string>;
}

/** 流式事件类型：抹平 Claude 流式与 DeepSeek 非流式的差异 */
export type StreamEvent =
    | { type: "text_delta"; text: string }
    | { type: "tool_use"; name: string; input: Record<string, unknown> }
    | { type: "text_done"; text: string };

// ── 配置解析（参考 pico provider_env 多环境变量回退模式）──

/** 从环境变量读取模型配置，provider 默认 deepseek */
function getDefaultModelConfig(): ModelConfig {
    const provider = (process.env.MODEL_PROVIDER as ModelProvider) || "deepseek";

    if (provider === "claude") {
        return {
            provider: "claude",
            apiKey: process.env.CLAUDE_API_KEY || "sk-ant-placeholder",
            model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
            baseURL: "https://api.anthropic.com",
        };
    }

    return {
        provider: "deepseek",
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        model: "deepseek-v4-pro",
        baseURL: "https://api.deepseek.com/anthropic",
    };
}

/** 工厂函数：根据配置创建 Anthropic SDK client（参考 pico 多后端统一构造模式） */
export function createAnthropicClient(config?: ModelConfig): Anthropic {
    const cfg = config || getDefaultModelConfig();
    return new Anthropic({
        apiKey: cfg.apiKey,
        baseURL: cfg.baseURL,
    });
}

// ── 非流式客户端（react-runtime / plan-execute / reflection / context-manager）──

/** 非流式模型客户端，实现 ModelClient 接口 */
export class AnthropicModelClient implements ModelClient {
    private client: Anthropic;
    private model: string;

    constructor(config?: ModelConfig) {
        const cfg = config || getDefaultModelConfig();
        this.client = new Anthropic({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL,
        });
        this.model = cfg.model;
    }

    /** 将消息列表发给模型，返回纯文本 */
    async chat(messages: Message[], signal?: AbortSignal): Promise<string> {
        const systemMsg = messages.find((m) => m.role === "system");
        const systemPrompt = systemMsg?.content;
        const chatMessages = messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 8192,
            system: systemPrompt,
            messages: chatMessages,
        }, { signal });

        // 将 text + tool_use block 统一转为文本，兼容 Runtime 的 XML 解析
        const parts: string[] = [];
        for (const block of response.content) {
            if (block.type === "text") {
                parts.push(block.text);
            } else if (block.type === "tool_use") {
                parts.push(
                    `<tool_call>${JSON.stringify({ name: block.name, arguments: block.input })}</tool_call>`,
                );
            }
        }
        return parts.join("");
    }
}

// ── 流式客户端（stream route）─────────────────────────────

/** 流式模型客户端，统一 Claude 流式与 DeepSeek 非流式为 AsyncGenerator */
export class StreamingModelClient {
    private client: Anthropic;
    private model: string;
    private provider: ModelProvider;

    constructor(config?: ModelConfig) {
        const cfg = config || getDefaultModelConfig();
        this.client = new Anthropic({
            apiKey: cfg.apiKey,
            baseURL: cfg.baseURL,
        });
        this.model = cfg.model;
        this.provider = cfg.provider;
    }

    /**
     * 发起一次带工具的模型调用，逐步产出统一格式的 StreamEvent。
     * chatMessages 已由调用方过滤掉 system 消息，system 作为独立参数传入。
     */
    async *streamChat(
        system: string | undefined,
        chatMessages: { role: "user" | "assistant"; content: string }[],
        tools: Anthropic.Tool[],
    ): AsyncGenerator<StreamEvent> {
        // Claude：真实流式，token 逐个到达（参考 Claude Messages Streaming API）
        if (this.provider === "claude") {
            const stream = this.client.messages.stream({
                model: this.model,
                max_tokens: 4096,
                system,
                messages: chatMessages,
                tools,
            });

            let currentToolName = "";
            let currentToolInput = "";

            for await (const event of stream) {
                // Anthropic SDK 流式事件分两层：外层 event.type 是阶段（content_block_start / delta / stop），
                // 内层 event.delta.type 是内容类型（text_delta / input_json_delta）
                if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
                    currentToolName = event.content_block.name;
                    currentToolInput = "";
                } else if (event.type === "content_block_delta") {
                    if (event.delta.type === "text_delta") {
                        yield { type: "text_delta", text: event.delta.text };
                    } else if (event.delta.type === "input_json_delta") {
                        currentToolInput += event.delta.partial_json;
                    }
                } else if (event.type === "content_block_stop") {
                    if (currentToolName) {
                        try {
                            yield {
                                type: "tool_use",
                                name: currentToolName,
                                input: JSON.parse(currentToolInput) as Record<string, unknown>,
                            };
                        } catch {
                            // 工具输入 JSON 解析失败，跳过当前 tool_use
                        }
                        currentToolName = "";
                        currentToolInput = "";
                    }
                }
            }
        } else {
            // DeepSeek：不支持带 tools 参数的流式输出，一次性非流式调用
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 4096,
                system,
                messages: chatMessages,
                tools,
            });

            // 提取文本块
            const textBlocks = response.content.filter(
                (b): b is Anthropic.TextBlock => b.type === "text",
            );
            const toolBlocks = response.content.filter(
                (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
            );

            const fullText = textBlocks.map((b) => b.text).join("");
            if (fullText) {
                yield { type: "text_done", text: fullText };
            }

            // 提取工具调用
            for (const tb of toolBlocks) {
                yield {
                    type: "tool_use",
                    name: tb.name,
                    input: tb.input as Record<string, unknown>,
                };
            }
        }
    }
}
