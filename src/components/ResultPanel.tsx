"use client";
import { getToolMeta, formatArgs } from "./tool-icons";
import EvalLabeler from "./EvalLabeler";
import MarkdownRenderer from "./MarkdownRenderer";
import { useAgentState } from "@/context/agent-context";
import { Button } from "@/components/ui/button";
import {
    SearchCheck,
    AlertTriangle,
    RotateCcw,
    Loader2,
    CheckCircle2,
    XCircle,
    MessageSquarePlus,
    ChevronDown,
    Terminal,
    ShieldCheck,
    Database,
    Activity,
    Hourglass,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultPanelProps {
    onOpenTrace: () => void;
    onOpenEval: () => void;
    onRetry: () => void;
    onPostComment: () => void;
    postResult: { ok: boolean; message: string } | null;
}

/** 单条工具调用（运行中活动流 / 完成态记录通用） */
function ToolStepRow({ step, executing }: { step: { step: number; toolName: string; args?: Record<string, unknown>; observation?: string }; executing: boolean }) {
    const meta = getToolMeta(step.toolName);
    const Icon = meta.icon;
    const argText = formatArgs(step.args ?? {});
    return (
        <div
            className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs",
                executing ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            )}
        >
            <span className={cn("size-1.5 rounded-full shrink-0", executing ? "bg-primary animate-pulse" : "bg-green-500")} />
            <Icon className={cn("size-3.5 shrink-0", executing ? "text-primary" : "text-muted-foreground")} />
            <span className="font-medium">{meta.label}</span>
            {argText && <span className="text-muted-foreground truncate flex-1">{argText}</span>}
            {executing ? (
                <span className="text-muted-foreground shrink-0">执行中…</span>
            ) : (
                <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
            )}
        </div>
    );
}

export default function ResultPanel({
    onOpenTrace,
    onOpenEval,
    onRetry,
    onPostComment,
    postResult,
}: ResultPanelProps) {
    const { mainAnswer, verifyAnswer, verifyResult, status, phase, toolSteps, reviewMode, error, limited } = useAgentState();

    return (
        <div className="h-full flex flex-col">
            {/* 顶栏 */}
            <div className="h-10 border-b flex items-center justify-between px-4 shrink-0">
                <h2 className="text-sm font-medium">审查结果</h2>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={onOpenEval} className="gap-1.5">
                        <Database className="size-3.5" />
                        标注样本
                    </Button>
                    {toolSteps.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={onOpenTrace} className="gap-1.5">
                            <Activity className="size-3.5" />
                            执行追踪
                            <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">{toolSteps.length}</span>
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* 空闲态：限流提示 / 等待审查 */}
                {status === "idle" && (
                    limited ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="size-12 rounded-xl bg-amber-500/10 grid place-items-center text-amber-600 dark:text-amber-400 mb-4">
                                <Hourglass className="size-6" />
                            </div>
                            <p className="text-sm font-medium">个人 DEMO</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                                体验次数已用完，继续使用请联系作者
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center px-8">
                            <div className="size-12 rounded-xl bg-muted grid place-items-center text-muted-foreground mb-4">
                                <SearchCheck className="size-6" />
                            </div>
                            <p className="text-sm font-medium">等待审查</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                                在左侧粘贴代码或 PR 链接，选择运行模式后开始审查
                            </p>
                        </div>
                    )
                )}

                {/* 运行中：agent 状态条 + 工具活动流 + 流式答案 */}
                {status === "running" && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-2.5">
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-primary" />
                            </span>
                            <span className="text-sm font-medium">
                                {phase === "verifying" ? "验证结果中" : "Agent 执行中"}
                            </span>
                            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" />
                                已调用 {toolSteps.length} 步工具
                            </span>
                        </div>

                        {toolSteps.length > 0 && (
                            <div className="space-y-1.5">
                                {toolSteps.map((s) => (
                                    <ToolStepRow key={s.step} step={s} executing={!s.observation} />
                                ))}
                            </div>
                        )}

                        {mainAnswer && (
                            <div className="rounded-lg border bg-card p-4 shadow-sm">
                                <MarkdownRenderer content={mainAnswer} />
                            </div>
                        )}
                        {phase === "verifying" && verifyAnswer && (
                            <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:bg-amber-500/10">
                                <MarkdownRenderer content={verifyAnswer} />
                            </div>
                        )}
                    </div>
                )}

                {/* 错误态 */}
                {status === "error" && (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <div className="size-12 rounded-xl bg-destructive/10 grid place-items-center text-destructive mb-4">
                            <AlertTriangle className="size-6" />
                        </div>
                        <p className="text-sm font-medium">审查失败</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[280px] break-all">{error || "请求失败，请重试"}</p>
                        <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onRetry}>
                            <RotateCcw className="size-3.5" />
                            重新审查
                        </Button>
                    </div>
                )}

                {/* 完成态 */}
                {status === "done" && mainAnswer && (
                    <div className="space-y-4 pb-8">
                        {/* 工具调用记录（折叠） */}
                        {toolSteps.length > 0 && (
                            <details open className="rounded-lg border bg-card group">
                                <summary className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium cursor-pointer list-none">
                                    <Terminal className="size-3.5 text-muted-foreground" />
                                    工具调用记录
                                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {toolSteps.length}
                                    </span>
                                    <ChevronDown className="size-3.5 ml-auto text-muted-foreground transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="px-3.5 pb-3 space-y-1.5">
                                    {toolSteps.map((s) => (
                                        <ToolStepRow key={s.step} step={s} executing={false} />
                                    ))}
                                </div>
                            </details>
                        )}

                        {/* 主答案 */}
                        <div className="rounded-lg border bg-card p-4 shadow-sm">
                            <MarkdownRenderer content={mainAnswer} />
                        </div>

                        {/* 验证报告（折叠） */}
                        {verifyAnswer && (
                            <details open className="rounded-lg border border-amber-300/60 bg-amber-50 group dark:bg-amber-500/10">
                                <summary className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium cursor-pointer list-none text-amber-700 dark:text-amber-400">
                                    <ShieldCheck className="size-3.5" />
                                    验证报告
                                    <ChevronDown className="size-3.5 ml-auto transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="px-3.5 pb-3.5">
                                    <MarkdownRenderer content={verifyAnswer} />
                                </div>
                            </details>
                        )}

                        <EvalLabeler reviewOutput={mainAnswer} verifyOutput={verifyAnswer || undefined} />

                        {/* 验证结果 */}
                        {verifyResult && (
                            <div
                                className={cn(
                                    "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium",
                                    verifyResult.passed
                                        ? "border-green-300/60 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                        : "border-red-300/60 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                )}
                            >
                                {verifyResult.passed ? (
                                    <CheckCircle2 className="size-4 shrink-0" />
                                ) : (
                                    <XCircle className="size-4 shrink-0" />
                                )}
                                {verifyResult.passed ? "验证通过" : "验证未通过"}
                                {!verifyResult.passed && (
                                    <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={onRetry}>
                                        <RotateCcw className="size-3.5" />
                                        重新审查
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* PR Comment */}
                        {reviewMode === "pr" && (
                            <div className="space-y-2">
                                <Button className="w-full gap-2" onClick={onPostComment}>
                                    <MessageSquarePlus className="size-4" />
                                    发布 PR Comment
                                </Button>
                                {postResult && (
                                    <p className={cn("text-xs text-center", postResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                                        {postResult.ok ? "✅ 评论已发布到 PR" : postResult.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
