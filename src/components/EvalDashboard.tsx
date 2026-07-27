"use client";
import { useEffect, useState } from "react";
import type { EvalSample } from "@/agent/eval-store";

interface Stats {
    total: number;
    accurate: number;
    inaccurate: number;
    partial: number;
}

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
            <div className="grid grid-cols-4 gap-2">
                <div className="bg-muted rounded p-3 text-center">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">标注总数</div>
                </div>
                <div className="bg-green-50 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.accurate}</div>
                    <div className="text-xs text-muted-foreground">👍 准确</div>
                </div>
                <div className="bg-red-50 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.inaccurate}</div>
                    <div className="text-xs text-muted-foreground">👎 误报</div>
                </div>
                <div className="bg-yellow-50 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
                    <div className="text-xs text-muted-foreground">⚠️ 部分</div>
                </div>
            </div>

            <div className="text-sm text-muted-foreground text-right">
                准确率：{accuracy}%
            </div>

            <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">标注记录</div>
                {samples.map((s) => (
                    <details key={s.id} className="border rounded p-2 text-xs">
                        <summary className="cursor-pointer flex items-center gap-2">
                            <span className={s.label === "accurate" ? "text-green-600" : s.label === "inaccurate" ? "text-red-600" : "text-yellow-600"}>
                                {s.label === "accurate" ? "👍" : s.label === "inaccurate" ? "👎" : "⚠️"}
                            </span>
                            <span className="text-muted-foreground">{s.id}</span>
                            {s.superseded && (
                                <span className="text-muted-foreground line-through text-[10px]">已覆盖</span>
                            )}
                            <span className="text-muted-foreground ml-auto">
                                {new Date(s.timestamp).toLocaleString("zh-CN")}
                            </span>
                        </summary>
                        <div className="mt-2 space-y-2 pl-4 border-l-2">
                            <div>
                                <div className="font-medium text-muted-foreground">审查结果</div>
                                <pre className="whitespace-pre-wrap mt-1">{s.reviewOutput}</pre>
                            </div>
                            {s.verifyOutput && (
                                <div>
                                    <div className="font-medium text-muted-foreground">验证报告</div>
                                    <pre className="whitespace-pre-wrap mt-1">{s.verifyOutput}</pre>
                                </div>
                            )}
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
}
