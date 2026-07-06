import * as fs from "node:fs";
import path from "node:path";
import { TraceEntry } from "./tool-executor";

const RUNS_DIR = path.join(process.cwd(), ".agent", "runs");

/** 单次运行审计记录（参考 pico RunStore） */
interface RunReport {
    runId: string;
    startedAt: string;
    prompt: string;
    answer: string;
    toolSteps: number;
    traces: TraceEntry[];
    contextStats: unknown;
}

/** 生成 runId */
export function newRunId(): string {
    const ts = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
    const rand = Math.random().toString(36).slice(2, 8);
    return `run_${ts}-${rand}`;
}

/** 追加一行到 trace.jsonl */
export function appendTrace(runId: string, event: Record<string, unknown>): void {
    const dir = path.join(RUNS_DIR, runId);
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ ...event, created_at: new Date().toISOString() }) + "\n";
    fs.appendFileSync(path.join(dir, "trace.jsonl"), line, "utf-8");
}

/** 写入最终报告 report.json */
export function writeReport(runId: string, report: RunReport): void {
    const dir = path.join(RUNS_DIR, runId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2), "utf-8");
}
