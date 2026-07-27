import { NextRequest } from "next/server";
import { createAnthropicClient } from "@/agent/model-client";

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  const client = createAnthropicClient();
  const stream = client.messages.stream({
    model: process.env.MODEL_PROVIDER === "claude"
      ? (process.env.CLAUDE_MODEL || "claude-sonnet-4-6")
      : "deepseek-v4-pro",
    max_tokens: 1024,
    system: "你是一个毒舌的程序员，回答里要带嘲讽但一针见血",
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
        );
      });
      await stream.finalMessage();
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
