import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

// ============================================================
// createAnthropic() = 手写版 new Anthropic({ baseURL: ... })
// 因为 DeepSeek 兼容 Anthropic 协议，但服务器地址不同
// ============================================================
const anthropicClient = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,           // 从 .env.local 读取
  baseURL: "https://api.deepseek.com/anthropic",    // DeepSeek 的 Anthropic 兼容地址
});

// ============================================================
// anthropicClient("模型名") = 手写版 model 参数
// 以后换模型只改这一行
// ============================================================
const model = anthropicClient("deepseek-v4-pro");

export async function POST(request: Request) {
  // 从请求体取出用户消息
  const { prompt, system } = await request.json();

  const result = streamText({
    model,
    system: system || "你用中文回答，简洁准确。",
    messages: [{ role: "user", content: prompt }],
  });

  // toTextStreamResponse() 自动设置 SSE 响应：
  //   Content-Type: text/event-stream
  //   Cache-Control: no-cache
  //   Connection: keep-alive
  return result.toTextStreamResponse();
}
