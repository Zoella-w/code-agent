"use client";
import { useState } from "react";
import type { EvalLabel } from "@/agent/eval-store";

interface EvalLabelerProps {
    reviewOutput: string;
    verifyOutput?: string;
    onLabeled?: () => void;
}

const LABEL_OPTIONS: { value: EvalLabel; emoji: string; text: string }[] = [
    { value: "accurate", emoji: "👍", text: "准确" },
    { value: "inaccurate", emoji: "👎", text: "误报" },
    { value: "partial", emoji: "⚠️", text: "部分准确" },
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
            <>
                <div className="text-xs text-muted-foreground text-center py-2">
                    已标注 ✓
                </div>
                <button
                    onClick={handleReset}
                    className="text-xs px-4 py-1.5 rounded bg-primary text-primary-foreground"
                >
                    重新标注
                </button>
            </>

        );
    }

    return (
        <div className="border-t pt-3 mt-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">标注审查质量</div>

            <div className="flex gap-2">
                {LABEL_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => setLabel(opt.value)}
                        disabled={submitting}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${label === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted-foreground/20 hover:border-muted-foreground/50"
                            }`}
                    >
                        {opt.emoji} {opt.text}
                    </button>
                ))}
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="补充说明（可选）"
                className="w-full text-xs border rounded p-2 resize-none h-12"
                disabled={submitting}
            />

            <button
                onClick={handleSubmit}
                disabled={!label || submitting}
                className="text-xs px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
            >
                {submitting ? "提交中..." : "提交标注"}
            </button>
        </div>
    );
}
