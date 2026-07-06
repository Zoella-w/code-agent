"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ToolCallCard from "./ToolCallCard";

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

interface ContextStats {
    beforeTokens: number;
    afterTokens: number;
    compressionRate: string;
}

interface TraceViewerProps {
    open: boolean;
    onClose: () => void;
    traces: TraceEntry[];
    toolSteps: ToolStep[];
    contextStats: ContextStats | null;
}

export default function TraceViewer({
    open,
    onClose,
    traces,
    toolSteps,
    contextStats,
}: TraceViewerProps) {
    const steps = traces.length > 0 ? traces : toolSteps;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="bottom" className="h-[50vh]">
                <SheetHeader>
                    <SheetTitle>执行追踪</SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-2 overflow-auto h-full">
                    {contextStats && (
                        <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
                            <span>压缩前: {contextStats.beforeTokens} tokens</span>
                            <span>压缩后: {contextStats.afterTokens} tokens</span>
                            <span>压缩率: {contextStats.compressionRate}</span>
                        </div>
                    )}

                    {steps.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                            暂无追踪记录
                        </p>
                    ) : (
                        steps.map((step, i) => {
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
                                    <span className="text-xs text-muted-foreground mb-1 block">
                                        步骤 {i + 1}
                                    </span>
                                    <ToolCallCard {...cardProps} />
                                </div>
                            );
                        })
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
