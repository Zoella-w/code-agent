"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ToolCallCard from "./ToolCallCard";
import { useAgentState } from "@/context/agent-context";
import { Activity, Gauge } from "lucide-react";

interface TraceEntry {
    toolName: string;
    args: Record<string, unknown>;
    success: boolean;
    durationMs: number;
    contentPreview: string;
    timestamp: number;
}

interface ToolStep {
    step: number;
    toolName: string;
    args: Record<string, unknown>;
    observation?: string;
}

interface TraceViewerProps {
    open: boolean;
    onClose: () => void;
}

export default function TraceViewer({ open, onClose }: TraceViewerProps) {
    // 数据走 Context；open/onClose 是 page 的本地 UI 状态，走 props
    const { traces, toolSteps, contextStats } = useAgentState();
    const steps = traces.length > 0 ? traces : toolSteps;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="bottom" className="h-[55vh]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Activity className="size-4 text-muted-foreground" />
                        执行追踪
                    </SheetTitle>
                </SheetHeader>

                <div className="mt-4 overflow-auto h-full pr-1">
                    {/* 上下文压缩统计 */}
                    {contextStats && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                压缩前 {contextStats.beforeTokens} tokens
                            </span>
                            <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                                压缩后 {contextStats.afterTokens} tokens
                            </span>
                            <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary">
                                压缩率 {contextStats.compressionRate}
                            </span>
                        </div>
                    )}

                    {steps.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-10">
                            暂无追踪记录
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {steps.map((step, i) => {
                                const isTrace = "durationMs" in step;
                                const cardProps = {
                                    toolName: step.toolName,
                                    args: step.args,
                                    success: isTrace ? (step as TraceEntry).success : true,
                                    durationMs: isTrace ? (step as TraceEntry).durationMs : 0,
                                    contentPreview: isTrace
                                        ? (step as TraceEntry).contentPreview
                                        : (step as ToolStep).observation || JSON.stringify(step.args),
                                };

                                return (
                                    <div key={`trace-${i}`}>
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                                            <Gauge className="size-3" />
                                            步骤 {i + 1}
                                        </div>
                                        <ToolCallCard {...cardProps} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
