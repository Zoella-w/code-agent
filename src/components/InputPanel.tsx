"use client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Editor from "react-simple-code-editor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useAgentState, useAgentDispatch } from "@/context/agent-context";
import { useDarkMode } from "@/hooks/useDarkMode";
import { Check, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

// 行为走 props，数据走 Context
interface InputPanelProps {
    onSend: () => void;
    onStop: () => void;
}

const REVIEW_TYPES = [
    { value: "code" as const, label: "代码审查" },
    { value: "pr" as const, label: "PR 审查" },
];

const MODES = [
    { value: "react" as const, label: "ReAct" },
    { value: "plan-execute" as const, label: "Plan & Execute" },
    { value: "reflection" as const, label: "Reflection" },
];

/** 统一的分区标题 */
function SectionLabel({ children }: { children: React.ReactNode }) {
    return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

export default function InputPanel({ onSend, onStop }: InputPanelProps) {
    const { code, question, mode, verify, status, reviewMode, prUrl, githubToken, limited } = useAgentState();
    const dispatch = useAgentDispatch();
    const dark = useDarkMode();

    const isRunning = status === "running";
    const canSend = (reviewMode === "pr" ? prUrl.trim() : (code.trim() || question.trim())) && !isRunning && !limited;

    const highlight = (text: string) => (
        <SyntaxHighlighter
            language="typescript"
            style={dark ? oneDark : oneLight}
            customStyle={{ margin: 0, padding: "0.75rem 0.875rem", minHeight: "100%", fontSize: "0.8rem", background: "transparent", fontFamily: '"Fira Code", "Fira Mono", monospace' }}
        >
            {text}
        </SyntaxHighlighter>
    );

    const inputClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

    return (
        <div className="h-full flex flex-col p-4 gap-4">
            {/* 审查类型：segmented 控件 */}
            <div className="flex flex-col gap-1.5">
                <SectionLabel>审查类型</SectionLabel>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1">
                    {REVIEW_TYPES.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            disabled={isRunning}
                            onClick={() => dispatch({ type: "SET_REVIEW_MODE", payload: t.value })}
                            className={cn(
                                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                                reviewMode === t.value
                                    ? "bg-background text-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 运行模式：pill radio */}
            <div className="flex flex-col gap-1.5">
                <SectionLabel>运行模式</SectionLabel>
                <div className="flex gap-2">
                    {MODES.map((m) => (
                        <button
                            key={m.value}
                            type="button"
                            disabled={isRunning}
                            onClick={() => dispatch({ type: "SET_MODE", payload: m.value })}
                            className={cn(
                                "flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                                mode === m.value
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 验证开关：styled checkbox，整行可点 */}
            <div
                role="checkbox"
                aria-checked={verify}
                aria-disabled={isRunning}
                onClick={() => !isRunning && dispatch({ type: "SET_VERIFY", payload: !verify })}
                className={cn("flex items-center gap-2 text-sm cursor-pointer select-none", isRunning && "opacity-50 cursor-default")}
            >
                <span
                    className={cn(
                        "grid place-items-center size-4 rounded border transition-colors",
                        verify ? "bg-primary border-primary text-primary-foreground" : "border-input bg-background hover:border-ring"
                    )}
                >
                    {verify && <Check className="size-3" />}
                </span>
                <span>
                    开启验证环
                    <span className="text-muted-foreground">（生成后自检）</span>
                </span>
            </div>

            {/* 代码输入区 / PR URL 输入 */}
            {reviewMode === "pr" ? (
                <>
                    <div className="flex flex-col gap-1.5">
                        <SectionLabel>PR URL</SectionLabel>
                        <input
                            type="text"
                            value={prUrl}
                            onChange={(e) => dispatch({ type: "SET_PR_URL", payload: e.target.value })}
                            placeholder="https://github.com/owner/repo/pull/123"
                            className={inputClass}
                            disabled={isRunning}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <SectionLabel>GitHub Token（可选，私有仓库必填）</SectionLabel>
                        <input
                            type="password"
                            value={githubToken}
                            onChange={(e) => dispatch({ type: "SET_GITHUB_TOKEN", payload: e.target.value })}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className={inputClass}
                            disabled={isRunning}
                        />
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                    <SectionLabel>代码</SectionLabel>
                    <div className="flex-1 min-h-0 rounded-lg border border-input bg-muted/30 overflow-hidden focus-within:border-ring">
                        <Editor
                            value={code}
                            onValueChange={(code) => dispatch({ type: "SET_CODE", payload: code })}
                            highlight={highlight}
                            placeholder="在此粘贴需要审查的代码..."
                            disabled={isRunning}
                            className="h-full"
                            style={{
                                fontFamily: '"Fira Code", "Fira Mono", monospace',
                                fontSize: "0.8rem",
                                background: "transparent",
                            }}
                            textareaClassName="outline-none"
                        />
                    </div>
                </div>
            )}

            {/* 问题输入区 */}
            <div className="flex flex-col gap-1.5">
                <SectionLabel>审查要求</SectionLabel>
                <Textarea
                    value={question}
                    onChange={(e) => dispatch({ type: "SET_QUESTION", payload: e.target.value })}
                    placeholder="例如：分析这段代码的安全漏洞"
                    className="resize-none h-20"
                    disabled={isRunning}
                />
            </div>

            {/* 发送/停止按钮 */}
            {isRunning ? (
                <Button onClick={onStop} variant="destructive" className="w-full gap-2" size="lg">
                    <Square className="size-4" />
                    停止
                </Button>
            ) : (
                <>
                    <Button onClick={onSend} disabled={!canSend} className="w-full gap-2" size="lg">
                        <Send className="size-4" />
                        开始审查
                    </Button>
                    {limited && (
                        <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                            个人 DEMO，体验次数已用完，继续使用请联系作者
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
