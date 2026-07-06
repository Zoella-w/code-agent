import { NextRequest, NextResponse } from "next/server";
import { getExecutor } from "@/agent/executor-store";

export async function POST(request: NextRequest) {
    const { runId, approved } = await request.json();

    if (!runId || typeof approved !== "boolean") {
        return NextResponse.json({ error: "缺少 runId 或 approved 参数" }, { status: 400 });
    }

    const executor = getExecutor(runId);
    if (!executor) {
        return NextResponse.json({ error: "未找到对应的执行会话" }, { status: 404 });
    }

    executor.resolveApproval(runId, approved);
    return NextResponse.json({ success: true });
}
