import { NextRequest, NextResponse } from "next/server";
import { DurableMemoryStore } from "@/agent/durable-memory";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), ".agent", "memory");

/** POST: 保存 durable memory 笔记（topic + note_text） */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { promotions } = body as { promotions?: [string, string][] };

    if (!promotions || !Array.isArray(promotions) || promotions.length === 0) {
        return NextResponse.json({ error: "缺少 promotions 数组" }, { status: 400 });
    }

    const store = new DurableMemoryStore(STORAGE_ROOT);
    const promoted = store.promote(promotions);
    return NextResponse.json({ promoted, topics: store.topicSlugs() });
}

/** GET: 列出所有主题和笔记 */
export async function GET() {
    const store = new DurableMemoryStore(STORAGE_ROOT);
    const topics = store.loadIndex();
    const result: Record<string, string[]> = {};
    for (const t of topics) {
        result[t.slug] = store.loadTopicNotes(t.slug);
    }
    return NextResponse.json({ topics: result });
}
