"use client";
import { useState } from "react";
import type { EvalLabel } from "@/agent/eval-store";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EvalLabelerProps {
    reviewOutput: string;
    verifyOutput?: string;
    onLabeled?: () => void;
}

const LABEL_OPTIONS: { value: EvalLabel; text: string; icon: typeof ThumbsUp; activeClass: string }[] = [
    { value: "accurate", text: "准确", icon: ThumbsUp, activeClass: "border-green-500/60 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" },
    { value: "inaccurate", text: "误报", icon: ThumbsDown, activeClass: "border-red-500/60 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
    { value: "partial", text: "部分准确", icon: AlertTriangle, activeClass: "border-amber-500/60 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
];

export default function EvalLabeler({ reviewOutput, verifyOutput, onLabeled }: EvalLabelerProps) {
    const [label, setLabel] = useState<EvalLabel | null>(null);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [lastSampleId, setLastSampleId] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!label || submitting) return;
        setSubmitting(true);
        try {
            if (lastSampleId) {
                await fetch("/api/agent/eval", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: lastSampleId }),
                });
            }

            const res = await fetch("/api/agent/eval", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reviewOutput,
                    verifyOutput,
                    label,
                    comment: comment.trim() || undefined,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setLastSampleId(data.sample.id);
                setDone(true);
                onLabeled?.();
            }
        } catch {
            // 静默失败，保留按钮允许重试
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setDone(false);
        setLabel(null);
        setComment("");
    };

    if (done) {
        return (
            <div className="flex items-center justify-between rounded-lg border bg-card px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ThumbsUp className="size-3.5 text-green-500" />
                    已标注
                </span>
                <Button variant="outline" size="sm" onClick={handleReset}>
                    重新标注
                </Button>
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card p-3.5 space-y-2.5">
            <div className="text-xs font-medium text-muted-foreground">标注审查质量</div>

            <div className="flex gap-2">
                {LABEL_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = label === opt.value;
                    return (
                        <button
                            key={opt.value}
                            onClick={() => setLabel(opt.value)}
                            disabled={submitting}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                                active ? opt.activeClass : "border-border text-muted-foreground hover:border-muted-foreground/50"
                            )}
                        >
                            <Icon className="size-3" />
                            {opt.text}
                        </button>
                    );
                })}
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="补充说明（可选）"
                className="w-full text-xs border border-input rounded-md p-2 resize-none h-12 outline-none bg-transparent placeholder:text-muted-foreground focus-visible:border-ring"
                disabled={submitting}
            />

            <Button
                onClick={handleSubmit}
                disabled={!label || submitting}
                className="w-full"
                size="sm"
            >
                {submitting ? "提交中..." : "提交标注"}
            </Button>
        </div>
    );
}
