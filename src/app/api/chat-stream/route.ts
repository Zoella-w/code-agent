// 提示1：需要从 @anthropic-ai/sdk import Anthropic
import Anthropic from "@anthropic-ai/sdk";
// 提示2：需要从 next/server import NextRequest
import { NextRequest } from "next/server";

// 提示3：创建 client（跟非流式版一模一样）
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.deepseek.com/anthropic"
});

export async function POST(request: NextRequest) {
  // 提示4：从 request 里取出用户 prompt（跟非流式版一模一样）
  const { prompt } = await request.json();

  // 提示5：创建流。跟非流式的区别：这里用 client.messages.stream() 而不是 .create()
  // 参数一模一样：model, max_tokens, system, messages
  const stream = client.messages.stream({
    model: "deepseek-v4-pro",
    max_tokens: 1024,
    system: "你是一个毒舌的程序员，回答里要带嘲讽但一针见血",
    messages: [{
      role: "user",
      content: prompt
    }]
  });

  // 提示6：TextEncoder 把字符串转成二进制字节（网络传输只能传字节）
  const encoder = new TextEncoder();

  // 提示7：构建 ReadableStream
  //   - 在里面监听 stream.on("text", (delta) => { ... })
  //   - 每次收到 delta，用 controller.enqueue() 推给浏览器
  //   - SSE 格式：data: {"delta":"文字"}\n\n
  //   - 流结束后 await stream.finalMessage()
  //   - 发送 data: [DONE]\n\n 然后 controller.close()
  const readable = new ReadableStream({
    async start(controller) {
      stream.on("text", (delta) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`)
        )
      })
      await stream.finalMessage();
      controller.enqueue(
        encoder.encode(`data: [DONE]\n\n`)
      );
      controller.close();
    }
  });

  // 提示8：返回 SSE 响应，Content-Type 必须是 text/event-stream
  // 提示9：格式是 new Response(readable, { headers: { ... } })
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
