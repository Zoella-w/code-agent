import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

const provider = process.env.MODEL_PROVIDER || "deepseek";
const isClaude = provider === "claude";

const anthropicClient = createAnthropic({
  apiKey: isClaude
    ? (process.env.CLAUDE_API_KEY || "sk-ant-placeholder")
    : (process.env.ANTHROPIC_API_KEY || ""),
  baseURL: isClaude
    ? "https://api.anthropic.com/v1"
    : "https://api.deepseek.com/anthropic/v1",
});

const model = anthropicClient(
  isClaude
    ? (process.env.CLAUDE_MODEL || "claude-sonnet-4-6")
    : "deepseek-v4-pro"
);

export async function POST(request: Request) {
  const { prompt, system } = await request.json();

  const result = streamText({
    model,
    system: system || "你用中文回答，简洁准确。",
    messages: [{ role: "user", content: prompt }],
  });

  return result.toTextStreamResponse();
}
