// 提示1：从哪个包里 import Anthropic？
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

// 提示2：new Anthropic({...}) 需要两个参数
//   - apiKey: 从环境变量读，名字是 ANTHROPIC_API_KEY
//   - baseURL: DeepSeek 的地址是 https://api.deepseek.com/anthropic
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.deepseek.com/anthropic"
});

export async function POST(request: NextRequest) {
  // 提示3：从 request 里取出用户发的 prompt
  // 提示4：用 await request.json() 来解析
  const { prompt, system } = await request.json();

  const response = await client.messages.create({
    model: "deepseek-v4-pro",
    max_tokens: 8192,
    system: system || "你用中文回答，简洁准确。",
    messages: [{
      role: "user",
      content: prompt
    }]
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return NextResponse.json({
    text,
    debug: {
      stopReason: response.stop_reason,
      contentTypes: response.content.map(b => b.type),
      textLength: text.length,
    }
  });
}