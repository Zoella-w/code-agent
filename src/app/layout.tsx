import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "Code Agent — AI 代码审查",
  description: "基于 ReAct 架构的智能代码审查助手",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body className="h-screen flex flex-col bg-background text-foreground">
        {/* 顶栏 */}
        <header className="h-12 border-b flex items-center px-4 shrink-0">
          <h1 className="font-semibold text-sm">Code Agent</h1>
          <span className="ml-2 text-xs text-muted-foreground">
            AI 代码审查
          </span>
        </header>
        {/* 主体：flex-1 撑满剩余空间，min-h-0 使内部可滚动 */}
        <main className="flex-1 min-h-0">{children}</main>
      </body>
    </html>
  );
}
