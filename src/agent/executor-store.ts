import { ToolExecutor } from "@/agent/tool-executor";

/** 全局共享：按 runId 存储 executor 实例，供 approve 端点查询 */
const executorStore = new Map<string, ToolExecutor>();

export function registerExecutor(runId: string, executor: ToolExecutor): void {
    executorStore.set(runId, executor);
}

export function getExecutor(runId: string): ToolExecutor | undefined {
    return executorStore.get(runId);
}

export function removeExecutor(runId: string): void {
    executorStore.delete(runId);
}
