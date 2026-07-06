import { NextRequest, NextResponse } from "next/server";
import { ToolRegistry } from "@/agent/tools";
import { readFileTool, searchCodeTool, listDirectoryTool, writeFileTool, analyzeCodeTool } from "@/agent/tool-defs";
import { AnthropicModelClient } from "@/agent/model-client";
import runReActLoop from "@/agent/react-runtime";
import { ToolExecutor } from "@/agent/tool-executor";
import { ContextManager } from "@/agent/context-manager";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    // 1. 注册工具
    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(searchCodeTool);
    registry.register(listDirectoryTool);
    registry.register(writeFileTool);
    registry.register(analyzeCodeTool);

    const executor = new ToolExecutor(registry);

    // 2. 创建模型客户端
    const model = new AnthropicModelClient();

    // 3. 初始化外部 ContextManager（用于获取裁剪数据）
    const ctxManager = new ContextManager(model, 1, 1);

    // 4. 跑 ReAct 循环
    const answer = await runReActLoop(prompt, registry, executor, model, ctxManager);
    const traces = executor.getTraces();

    return NextResponse.json({ answer, traces, contextStats: ctxManager.lastStats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
