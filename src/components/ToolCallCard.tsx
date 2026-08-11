"use client";
import { useState } from "react";
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getToolMeta } from "./tool-icons";
import { cn } from "@/lib/utils";

/** 单条工具调用记录 */
interface ToolCallCardProps {
    toolName: string;
    args: Record<string, unknown>;
    success: boolean;
    durationMs: number;
    contentPreview: string;
}

/** 把毫秒转成可读格式：1034ms → "1.0s"，87ms → "87ms" */
function formatDuration(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
}

/** 可折叠的工具调用卡片，展示工具名、耗时、参数和结果 */
export default function ToolCallCard({
    toolName,
    args,
    success,
    durationMs,
    contentPreview,
}: ToolCallCardProps) {
    // open = true 时展开，open = false 时收起
    const [open, setOpen] = useState(false);
    const meta = getToolMeta(toolName);
    const Icon = meta.icon;

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card overflow-hidden">
            {/* 摘要行：始终可见，点击展开/折叠 */}
            <CollapsibleTrigger
                className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted/60",
                    open && "bg-muted/40"
                )}
            >
                {/* 状态指示灯：绿色 = 成功，红色 = 失败 */}
                <span className={cn("size-1.5 rounded-full shrink-0", success ? "bg-green-500" : "bg-destructive")} />
                <Icon className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{toolName}</span>
                <span className="text-muted-foreground shrink-0">{formatDuration(durationMs)}</span>
                <span className="flex-1 text-muted-foreground truncate text-right">{contentPreview}</span>
                {open ? (
                    <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                )}
            </CollapsibleTrigger>

            {/* 展开内容：参数 + 完整结果 */}
            <CollapsibleContent>
                <div className="px-3 pb-3 space-y-2 text-xs border-t pt-2">
                    <div>
                        <span className="font-medium text-muted-foreground">参数: </span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
                            {JSON.stringify(args)}
                        </code>
                    </div>
                    <div>
                        <span className="font-medium text-muted-foreground">结果: </span>
                        <pre className="mt-1 whitespace-pre-wrap text-[11px] font-mono bg-muted/60 p-2 rounded-md max-h-32 overflow-auto">
                            {contentPreview}
                        </pre>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
