import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import ThemeToggle from "@/components/theme-toggle";
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
    <html lang="zh-CN" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body className="h-screen flex flex-col bg-background text-foreground">
        {/* 防闪 script：hydration 前读取存储/系统偏好，提前给 <html> 打 .dark，避免首屏白闪 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem("theme");
                  var dark = stored === "dark" ||
                    (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
                  if (dark) document.documentElement.classList.add("dark");
                } catch (e) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          {/* 顶栏 */}
          <header className="h-12 border-b flex items-center px-4 shrink-0">
            <h1 className="font-semibold text-sm">Code Agent</h1>
            <span className="ml-2 text-xs text-muted-foreground">
              AI 代码审查
            </span>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          {/* 主体：flex-1 撑满剩余空间，min-h-0 使内部可滚动 */}
          <main className="flex-1 min-h-0">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
