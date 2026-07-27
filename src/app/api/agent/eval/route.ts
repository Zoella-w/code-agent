import { NextRequest, NextResponse } from "next/server";
import { addSample, listSamples, markSuperseded, type EvalLabel } from "@/agent/eval-store";

const VALID_LABELS = ["accurate", "inaccurate", "partial"];

export async function POST(request: NextRequest) {
    try {
        const { reviewOutput, verifyOutput, label, comment } = await request.json();

        if (!reviewOutput || typeof reviewOutput !== "string") {
            return NextResponse.json({ error: "reviewOutput 为必填字符串" }, { status: 400 });
        }
        if (!label || !VALID_LABELS.includes(label)) {
            return NextResponse.json(
                { error: `label 必须为 ${VALID_LABELS.join(" / ")}` },
                { status: 400 },
            );
        }

        const sample = await addSample({
            reviewOutput,
            verifyOutput: typeof verifyOutput === "string" ? verifyOutput : undefined,
            label: label as EvalLabel,
            comment: typeof comment === "string" ? comment : undefined,
        });

        return NextResponse.json({ success: true, sample }, { status: 201 });
    } catch {
        return NextResponse.json({ error: "保存标注失败" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const samples = await listSamples();
        const active = samples.filter((s) => !s.superseded);
        const stats = {
            total: active.length,
            accurate: active.filter((s) => s.label === "accurate").length,
            inaccurate: active.filter((s) => s.label === "inaccurate").length,
            partial: active.filter((s) => s.label === "partial").length,
        };
        return NextResponse.json({ stats, samples });
    } catch {
        return NextResponse.json({ error: "读取标注失败" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { id } = await request.json();
        if (!id || typeof id !== "string") {
            return NextResponse.json({ error: "id 为必填字符串" }, { status: 400 });
        }
        const found = await markSuperseded(id);
        if (!found) {
            return NextResponse.json({ error: "样本不存在" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "标记失败" }, { status: 500 });
    }
}
