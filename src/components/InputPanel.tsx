"use client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Editor from "react-simple-code-editor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAgentState, useAgentDispatch } from "@/context/agent-context";

// 行为走 props，数据走 Context
interface InputPanelProps {
    onSend: () => void;
    onStop: () => void;
}

export default function InputPanel({ onSend, onStop }: InputPanelProps) {
    const { code, question, mode, verify, status, reviewMode, prUrl, githubToken } = useAgentState();
    const dispatch = useAgentDispatch();

    const isRunning = status === "running";
    const canSend = (reviewMode === "pr" ? prUrl.trim() : (code.trim() || question.trim())) && !isRunning;

    const highlight = (text: string) => (
        <SyntaxHighlighter language="typescript" style={oneLight} customStyle={{ margin: 0, padding: "0.5rem 0.75rem", minHeight: "100%", fontSize: "0.8rem", background: "transparent" }}>
            {text}
        </SyntaxHighlighter>
    );

    return (
        <div className="h-full flex flex-col p-4 gap-4">
            {/* 审查类型 */}
            <div className="flex gap-3 text-sm">
                {(["code", "pr"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="radio"
                            name="reviewMode"
                            value={t}
                            checked={reviewMode === t}
                            onChange={() => dispatch({ type: "SET_REVIEW_MODE", payload: t })}
                            disabled={isRunning}
                        />
                        {t === "code" ? "代码审查" : "PR 审查"}
                    </label>
                ))}
            </div>

            {/* 模式选择 */}
            <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">
                    运行模式
                </label>
                <div className="flex gap-3 text-sm">
                    {(["react", "plan-execute", "reflection"] as const).map((m) => (
                        <label key={m} className="flex items-center gap-1 cursor-pointer">
                            <input
                                type="radio"
                                name="mode"
                                value={m}
                                checked={mode === m}
                                onChange={() => dispatch({ type: "SET_MODE", payload: m })}
                                disabled={isRunning}
                            />
                            {m === "react" ? "ReAct" : m === "plan-execute" ? "Plan&Execute" : "Reflection"}
                        </label>
                    ))}
                </div>
            </div>

            {/* 验证开关 */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                    type="checkbox"
                    checked={verify}
                    onChange={(e) => dispatch({ type: "SET_VERIFY", payload: e.target.checked })}
                    disabled={isRunning}
                />
                开启验证（验证环）
            </label>

            {/* 代码输入区 / PR URL 输入 */}
            {reviewMode === "pr" ? (
                <>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            PR URL
                        </label>
                        <input
                            type="text"
                            value={prUrl}
                            onChange={(e) => dispatch({ type: "SET_PR_URL", payload: e.target.value })}
                            placeholder="https://github.com/owner/repo/pull/123"
                            className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                            disabled={isRunning}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">
                            GitHub Token（可选，私有仓库必填）
                        </label>
                        <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => dispatch({ type: "SET_GITHUB_TOKEN", payload: e.target.value })}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                            disabled={isRunning}
                        />
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col gap-2 min-h-0">
                    <label className="text-sm font-medium text-muted-foreground">
                        代码
                    </label>
                    <Editor
                        value={code}
                        onValueChange={(code) => dispatch({ type: "SET_CODE", payload: code })}
                        highlight={highlight}
                        placeholder="在此粘贴需要审查的代码..."
                        disabled={isRunning}
                        className="flex-1 border rounded-md overflow-auto"
                        style={{
                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                            fontSize: "0.8rem",
                            background: "#fafafa",
                        }}
                        textareaClassName="outline-none"
                    />
                </div>
            )}

            {/* 问题输入区 */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                    审查要求
                </label>
                <Textarea
                    value={question}
                    onChange={(e) => dispatch({ type: "SET_QUESTION", payload: e.target.value })}
                    placeholder="例如：分析这段代码的安全漏洞"
                    className="resize-none h-20"
                    disabled={isRunning}
                />
            </div>

            {/* 发送按钮 */}
            {isRunning ? (
                <Button onClick={onStop} className="w-full bg-red-500 hover:bg-red-600">
                    ⏹ 停止
                </Button>
            ) : (
                <Button onClick={onSend} disabled={!canSend} className="w-full">
                    发送审查
                </Button>
            )}
        </div>
    );
}
