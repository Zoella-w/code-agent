import { NextRequest } from "next/server";
import { createOrchestrateStream } from "@/agent/orchestrate";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { prompt, mode, verify } = body;

    if (!prompt || !mode) {
        return new Response(
            JSON.stringify({ error: "prompt 和 mode 为必填字段" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
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
