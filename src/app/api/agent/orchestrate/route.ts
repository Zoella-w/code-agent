import { NextRequest } from "next/server";
import { createOrchestrateStream } from "@/agent/orchestrate";
import { checkAndConsumeUsage, USAGE_ERROR_CODE, USAGE_MESSAGE } from "@/lib/usage-limit";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { prompt, mode, verify } = body;

    if (!prompt || !mode) {
        return new Response(
            JSON.stringify({ error: "prompt 和 mode 为必填字段" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    // 防滥用限流：按 IP 计数，超出个人 demo 额度直接拒绝（不调 LLM）
    const usage = await checkAndConsumeUsage(request);
    if (!usage.allowed) {
        return new Response(
            JSON.stringify({ error: USAGE_ERROR_CODE, message: USAGE_MESSAGE }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        );
    }

    const stream = createOrchestrateStream({ prompt, mode, verify }, undefined, request.signal);

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
