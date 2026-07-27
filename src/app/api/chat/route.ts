import { NextRequest, NextResponse } from "next/server";
import { AnthropicModelClient } from "@/agent/model-client";

export async function POST(request: NextRequest) {
  const { prompt, system } = await request.json();

  const client = new AnthropicModelClient();
  const text = await client.chat([
    { role: "system", content: system || "你用中文回答，简洁准确。" },
    { role: "user", content: prompt },
  ]);

  return NextResponse.json({
    text,
    debug: { textLength: text.length },
  });
}
