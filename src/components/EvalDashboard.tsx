"use client";
import { useEffect, useState } from "react";
import type { EvalSample } from "@/agent/eval-store";
import { Database, ThumbsUp, ThumbsDown, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
    total: number;
    accurate: number;
    inaccurate: number;
    partial: number;
}

const STAT_CARDS = [
    { key: "total" as const, label: "标注总数", icon: Database, valueClass: "text-foreground" },
    { key: "accurate" as const, label: "准确", icon: ThumbsUp, valueClass: "text-green-600 dark:text-green-400" },
    { key: "inaccurate" as const, label: "误报", icon: ThumbsDown, valueClass: "text-destructive" },
    { key: "partial" as const, label: "部分准确", icon: AlertTriangle, valueClass: "text-amber-600 dark:text-amber-400" },
];

export default function EvalDashboard() {
    const [samples, setSamples] = useState<EvalSample[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, accurate: 0, inaccurate: 0, partial: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/agent/eval")
            .then((res) => res.json())
            .then((data) => {
                setStats(data.stats);
                setSamples(data.samples);
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="text-sm text-muted-foreground text-center py-8">加载中...</div>;
    }

    if (samples.length === 0) {
        return <div className="text-sm text-muted-foreground text-center py-8">暂无标注样本</div>;
    }

    const accuracy = stats.total > 0
        ? Math.round((stats.accurate / stats.total) * 100)
        : 0;

    return (
        <div className="space-y-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 gap-2">
                {STAT_CARDS.map(({ key, label, icon: Icon, valueClass }) => (
                    <div key={key} className="rounded-lg border bg-card p-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                            <Icon className="size-3" />
                            {label}
                        </div>
                        <div className={cn("text-2xl font-bold leading-none", valueClass)}>
                            {stats[key]}
                        </div>
                    </div>
                ))}
            </div>

            {/* 准确率进度条 */}
            <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium">准确率</span>
                    <span className="text-muted-foreground">{accuracy}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${accuracy}%` }} />
                </div>
            </div>

            {/* 标注记录 */}
            <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">标注记录</div>
                {samples.map((s) => (
                    <details key={s.id} className="rounded-lg border bg-card group">
                        <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2 text-xs">
                            <span
                                className={cn(
                                    s.label === "accurate"
                                        ? "text-green-600 dark:text-green-400"
                                        : s.label === "inaccurate"
                                            ? "text-destructive"
                                            : "text-amber-600 dark:text-amber-400"
                                )}
                            >
                                {s.label === "accurate" ? "👍" : s.label === "inaccurate" ? "👎" : "⚠️"}
                            </span>
                            <span className="font-mono text-muted-foreground">{s.id}</span>
                            {s.superseded && (
                                <span className="text-muted-foreground line-through text-[10px]">已覆盖</span>
                            )}
                            <span className="text-muted-foreground ml-auto">
                                {new Date(s.timestamp).toLocaleString("zh-CN")}
                            </span>
                            <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-3 pb-3 space-y-2 pl-6 border-l-2 ml-3">
                            <div>
                                <div className="font-medium text-muted-foreground text-[11px]">审查结果</div>
                                <pre className="whitespace-pre-wrap mt-1 text-xs font-mono bg-muted/60 rounded-md p-2 overflow-auto">{s.reviewOutput}</pre>
                            </div>
                            {s.verifyOutput && (
                                <div>
                                    <div className="font-medium text-muted-foreground text-[11px]">验证报告</div>
                                    <pre className="whitespace-pre-wrap mt-1 text-xs font-mono bg-muted/60 rounded-md p-2 overflow-auto">{s.verifyOutput}</pre>
                                </div>
                            )}
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
}
