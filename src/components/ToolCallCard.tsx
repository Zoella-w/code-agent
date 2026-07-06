"use client";
import { useState } from "react";
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "@/components/ui/collapsible";

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

    return (
        <Collapsible open={open} onOpenChange={setOpen}>

            {/* CollapsibleTrigger：摘要行，始终可见，点击展开/折叠 */}
            <CollapsibleTrigger
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-xs hover:bg-muted/50
  transition-colors ${open ? "bg-muted/50" : ""}`}
            >
                {/* 状态指示灯：绿色点 = 成功，红色点 = 失败 */}
                <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${success ? "bg-green-500" : "bg-red-500"}`}
                />

                {/* 工具名 */}
                <span className="font-medium">{toolName}</span>

                {/* 耗时 */}
                <span className="text-muted-foreground">
                    {formatDuration(durationMs)}
                </span>

                {/* 结果预览：超长自动截断加省略号 */}
                {/* truncate：文本太长时用 ... 截断 */}
                <span className="flex-1 text-muted-foreground truncate text-right">
                    {contentPreview}
                </span>

                {/* 展开/收起提示 */}
                <span className="text-muted-foreground text-xs shrink-0">
                    {open ? "收起 ▲" : "展开 ▼"}
                </span>
            </CollapsibleTrigger>

            {/* 折叠内容：展开后显示参数 + 完整结果 */}
            {/* CollapsibleContent：在折叠时 display: none，展开时正常渲染 */}
            <CollapsibleContent>
                <div className="px-3 py-2 space-y-2 text-xs">
                    {/* 参数 */}
                    <div>
                        <span className="font-medium text-muted-foreground">参数: </span>
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                            {JSON.stringify(args)}
                        </code>
                    </div>

                    {/* 结果 */}
                    <div>
                        <span className="font-medium text-muted-foreground">结果: </span>
                        <pre className="mt-1 whitespace-pre-wrap text-xs bg-muted p-2 rounded-md max-h-32 overflow-auto">
                            {contentPreview}
                        </pre>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}