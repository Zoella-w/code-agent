"use client";
import { useRef, useEffect } from "react";
import EvalLabeler from "./EvalLabeler";

interface ChatMessage {
    role: "user" | "agent";
    content: string;
}

interface ToolStep {
    step: number;
    toolName: string;
    args: Record<string, unknown>;
}

interface VerifyResult {
    before: string;
    after: string;
    passed: boolean;
}

interface ChatPanelProps {
    messages: ChatMessage[];
    status: string;
    phase: string | null;
    mainAnswer: string;
    verifyAnswer: string;
    verifyResult: VerifyResult | null;
    toolSteps: ToolStep[];
    onOpenTrace: () => void;
    onOpenEval?: () => void;
}

export default function ChatPanel({
    messages,
    status,
    phase,
    mainAnswer,
    verifyAnswer,
    verifyResult,
    toolSteps,
    onOpenTrace,
    onOpenEval,
}: ChatPanelProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, mainAnswer, verifyAnswer, toolSteps]);

    const isRunning = status === "running";

    return (
        <div className="h-full flex flex-col">
            <div
                className="h-10 border-b flex items-center justify-between px-4 shrink-0"
                style={{ background: "#f5f5f5" }}
            >
                <h2 className="text-sm font-medium text-muted-foreground">对话</h2>
                <div className="flex gap-3">
                    {onOpenEval && (
                        <button
                            onClick={onOpenEval}
                            className="text-xs font-medium hover:underline transition-colors"
                        >
                            查看标注样本
                        </button>
                    )}
                    <button
                        onClick={onOpenTrace}
                        className="text-xs font-medium hover:underline transition-colors"
                    >
                        查看追踪 ({toolSteps.length} 步)
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4 space-y-3">
                    {messages
                        .filter((m) => m.role === "user")
                        .map((msg, i) => (
                            <div key={`user-${i}`} className="flex justify-end">
                                <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-primary text-primary-foreground">
                                    <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                                </div>
                            </div>
                        ))}

                    {toolSteps.map((step, i) => (
                        <div key={`tool-${i}`} className="flex justify-start">
                            <div className="rounded-lg px-3 py-1.5 text-xs" style={{ background: "#fafafa" }}>
                                ✅ {step.toolName}
                            </div>
                        </div>
                    ))}

                    {isRunning && !mainAnswer && (
                        <div className="flex justify-start">
                            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                                思考中...
                            </div>
                        </div>
                    )}

                    {mainAnswer && (
                        <div className="flex justify-start">
                            <div className="max-w-[80%] bg-muted rounded-lg px-3 py-2 text-sm">
                                <pre className="whitespace-pre-wrap font-sans text-sm">{mainAnswer}</pre>
                            </div>
                        </div>
                    )}

                    {phase === "verifying" && isRunning && (
                        <div className="flex justify-start">
                            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                                ✅ 验证中...
                            </div>
                        </div>
                    )}

                    {verifyAnswer && (
                        <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm border border-orange-200" style={{ background: "#fff7ed" }}>
                                <div className="text-xs font-medium text-orange-600 mb-1">验证报告</div>
                                <pre className="whitespace-pre-wrap font-sans text-sm">{verifyAnswer}</pre>
                            </div>
                        </div>
                    )}

                    {verifyResult && (
                        <div className="flex justify-center">
                            <div className={`text-xs px-3 py-1 rounded-full ${verifyResult.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                {verifyResult.passed ? "✅ 验证通过" : "❌ 验证未通过，请查看验证报告"}
                            </div>
                        </div>
                    )}

                    {status === "done" && mainAnswer && (
                        <EvalLabeler
                            reviewOutput={mainAnswer}
                            verifyOutput={verifyAnswer || undefined}
                        />
                    )}

                    {status === "error" && (
                        <div className="flex justify-center">
                            <div className="text-sm text-red-500">请求失败，请重试</div>
                        </div>
                    )}

                    {!isRunning && messages.length === 0 && status !== "error" && (
                        <p className="text-xs text-muted-foreground text-center py-8">
                            粘贴代码并输入审查要求，点击发送开始
                        </p>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
}
