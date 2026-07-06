import { NextRequest, NextResponse } from "next/server";
import { ToolRegistry } from "@/agent/tools";
import { readFileTool, searchCodeTool, listDirectoryTool, writeFileTool, analyzeCodeTool } from "@/agent/tool-defs";
import { AnthropicModelClient } from "@/agent/model-client";
import reflectAndExecute from "@/agent/reflection-runtime";
import { ToolExecutor } from "@/agent/tool-executor";

export async function POST(request: NextRequest) {
    const { prompt } = await request.json();

    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(searchCodeTool);
    registry.register(listDirectoryTool);
    registry.register(writeFileTool);
    registry.register(analyzeCodeTool);

    const executor = new ToolExecutor(registry);

    const model = new AnthropicModelClient();

    try {
        const { answer, rounds } = await reflectAndExecute(prompt, registry, executor, model);
        return NextResponse.json({ answer, rounds });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
