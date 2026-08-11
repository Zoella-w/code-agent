"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useDarkMode } from "@/hooks/useDarkMode";

interface MarkdownRendererProps {
    content: string;
}

/** 将 Markdown 文本渲染为格式化内容，代码块带语法高亮（跟随深浅色主题） */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
    const dark = useDarkMode();
    return (
        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ className, children, ...rest }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeText = String(children).replace(/\n$/, "");
                        if (match) {
                            return (
                                <SyntaxHighlighter
                                    style={dark ? oneDark : oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ fontSize: "0.8rem", borderRadius: "0.5rem" }}
                                >
                                    {codeText}
                                </SyntaxHighlighter>
                            );
                        }
                        return (
                            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono text-primary" {...rest}>
                                {children}
                            </code>
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
