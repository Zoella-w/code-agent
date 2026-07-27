import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 获取所有任务，最新的在前 */
export async function GET() {
    try {
        const tasks = await prisma.task.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json({ tasks });
    } catch {
        return NextResponse.json({ error: "读取任务失败" }, { status: 500 });
    }
}

/** 创建或更新任务（有 id 则更新，无 id 则新建） */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (!body.title || !body.mode) {
            return NextResponse.json({ error: "title 和 mode 为必填字段" }, { status: 400 });
        }
        const task = await prisma.task.upsert({
            where: { id: body.id ?? "" },
            update: {
                code: body.code,
                question: body.question,
                mode: body.mode,
                mainAnswer: body.mainAnswer,
                verifyAnswer: body.verifyAnswer,
                verifyResultPassed: body.verifyResultPassed,
                toolSteps: body.toolSteps,
                status: body.status,
            },
            create: {
                title: body.title,
                code: body.code ?? "",
                question: body.question ?? "",
                mode: body.mode,
                mainAnswer: body.mainAnswer ?? "",
                verifyAnswer: body.verifyAnswer ?? "",
                verifyResultPassed: body.verifyResultPassed,
                toolSteps: body.toolSteps ?? [],
                status: body.status ?? "idle",
            },
        });
        return NextResponse.json({ task }, { status: 201 });
    } catch {
        return NextResponse.json({ error: "保存任务失败" }, { status: 500 });
    }
}

/** 删除任务 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "id 为必填参数" }, { status: 400 });
        }
        await prisma.task.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "删除任务失败" }, { status: 500 });
    }
}
