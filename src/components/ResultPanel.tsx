"use client";
import type { VerifyResult } from "@/hooks/useAgent";

interface ResultPanelProps {
    mainAnswer: string;
    verifyAnswer: string;
    verifyResult: VerifyResult | null;
    status: string;
    phase: string | null;
    toolSteps: { step: number; toolName: string }[];
    reviewMode: "code" | "pr";
    onOpenTrace: () => void;
    onOpenEval: () => void;
    onRetry: () => void;
    onPostComment: () => void;
}

export default function ResultPanel({
    mainAnswer,
    verifyAnswer,
    verifyResult,
    status,
    phase,
    toolSteps,
    reviewMode,
    onOpenTrace,
    onOpenEval,
    onRetry,
    onPostComment,
}: ResultPanelProps) {
    return (
        <div className="h-full flex flex-col">
            <div className="h-10 border-b flex items-center justify-between px-4" style={{ background: "#f5f5f5" }}>
                <h2 className="text-sm font-medium">审查结果</h2>
                <div className="flex gap-3">
                    <button onClick={onOpenEval} className="text-xs font-medium hover:underline">
                        标注样本
                    </button>
                    {toolSteps.length > 0 && (
                        <button onClick={onOpenTrace} className="text-xs font-medium hover:underline">
                            查看追踪 ({toolSteps.length} 步)
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {status === "idle" && (
                    <p className="text-sm text-gray-400 text-center py-16">等待审查</p>
                )}

                {status === "running" && (
                    <div>
                        {toolSteps.map((step) => (
                            <div key={step.step} className="text-xs text-gray-500 mb-1">
                                ✅ {step.toolName}
                            </div>
                        ))}
                        {mainAnswer && (
                            <div className="text-sm whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 mb-4 leading-relaxed">
                                {mainAnswer}
                            </div>
                        )}
                        {phase === "verifying" && verifyAnswer && (
                            <div className="text-sm whitespace-pre-wrap font-mono bg-orange-50 rounded-lg p-4 mb-4 border border-orange-200 leading-relaxed">
                                {verifyAnswer}
                            </div>
                        )}
                        <p className="text-sm text-gray-400 text-center py-8">
                            {phase === "verifying" ? "验证中..." : "思考中..."}
                        </p>
                    </div>
                )}

                {status === "error" && (
                    <p className="text-sm text-red-500 text-center py-16">请求失败，请重试</p>
                )}

                {status === "done" && mainAnswer && (
                    <div className="space-y-4">
                        <div className="text-sm whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 leading-relaxed">
                            {mainAnswer}
                        </div>

                        {verifyAnswer && (
                            <details className="text-sm">
                                <summary className="cursor-pointer font-medium text-orange-600">
                                    验证报告 ▸
                                </summary>
                                <div className="mt-2 whitespace-pre-wrap font-mono bg-orange-50 rounded-lg p-4 border border-orange-200 leading-relaxed">
                                    {verifyAnswer}
                                </div>
                            </details>
                        )}

                        {verifyResult && (
                            <div
                                className={`text-sm px-4 py-2 rounded-lg text-center font-medium ${
                                    verifyResult.passed
                                        ? "bg-green-50 text-green-700 border border-green-200"
                                        : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                            >
                                {verifyResult.passed ? (
                                    "✅ 验证通过"
                                ) : (
                                    <>
                                        ❌ 验证未通过
                                        <button onClick={onRetry} className="ml-4 underline text-sm">
                                            重新审查
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {reviewMode === "pr" && (
                            <div className="text-center">
                                <button
                                    onClick={onPostComment}
                                    className="text-sm px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
                                >
                                    🚀 发布 PR Comment
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
