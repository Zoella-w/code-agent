"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
    content: string;
}

/** 将 Markdown 文本渲染为格式化内容，代码块带语法高亮 */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <div className="prose prose-sm max-w-none prose-headings:text-sm prose-headings:font-semibold prose-pre:p-0 prose-pre:bg-transparent">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ className, children, ...rest }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeText = String(children).replace(/\n$/, "");
                        if (match) {
                            return (
                                <SyntaxHighlighter
                                    style={oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ fontSize: "0.8rem", borderRadius: "0.5rem" }}
                                >
                                    {codeText}
                                </SyntaxHighlighter>
                            );
                        }
                        return (
                            <code className="bg-gray-100 rounded px-1 py-0.5 text-xs font-mono text-red-600" {...rest}>
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
