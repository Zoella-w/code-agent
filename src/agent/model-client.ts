import Anthropic from "@anthropic-ai/sdk";
import { ModelClient, Message } from "./react-runtime";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: "https://api.deepseek.com/anthropic",
});

/** 非流式 chat（保留给 /api/agent 使用） */
export class AnthropicModelClient implements ModelClient {
    async chat(messages: Message[]): Promise<string> {
        const systemMsg = messages.find((m) => m.role === "system");
        const systemPrompt = systemMsg?.content;
        const chatMessages = messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const response = await client.messages.create({
            model: "deepseek-v4-pro",
            max_tokens: 8192,
            system: systemPrompt,
            messages: chatMessages,
        });

        const text = response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");
        return text;
    }
}
