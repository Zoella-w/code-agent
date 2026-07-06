import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";

/** 项目根目录下的文档文件名（参考 pico DOC_NAMES） */
const DOC_NAMES = ["AGENTS.md", "README.md", "package.json", "CLAUDE.md", "tsconfig.json"];

/** 截断文本到指定长度 */
function clip(text: string, maxLen: number): string {
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

/** 安全执行 git 命令，失败返回空串 */
function git(args: string[], cwd: string): string {
    try {
        return execSync(`git ${args.join(" ")}`, { cwd, encoding: "utf-8", timeout: 5000 }).trim();
    } catch {
        return "";
    }
}

/** 工作区上下文（参考 pico WorkspaceContext） */
export interface WorkspaceContext {
    cwd: string;
    repoRoot: string;
    branch: string;
    recentCommits: string[];
    projectDocs: Record<string, string>;
}

/** 构建工作区上下文：扫描项目文档 + git 信息 */
export function buildWorkspaceContext(cwd?: string): WorkspaceContext {
    const dir = cwd ?? process.cwd();
    const repoRoot = git(["rev-parse", "--show-toplevel"], dir) || dir;
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot) || "unknown";
    const commits = git(["log", "--oneline", "-5"], repoRoot).split("\n").filter(Boolean);

    const docs: Record<string, string> = {};
    for (const base of [repoRoot, dir]) {
        for (const name of DOC_NAMES) {
            const filePath = path.join(base, name);
            if (!fs.existsSync(filePath)) continue;
            const key = path.relative(repoRoot, filePath);
            if (docs[key]) continue;
            docs[key] = clip(fs.readFileSync(filePath, "utf-8"), 1200);
        }
    }
    return { cwd: dir, repoRoot, branch, recentCommits: commits, projectDocs: docs };
}

/** 将工作区上下文格式化为 LLM 可见文本（参考 pico WorkspaceContext.text()） */
export function workspaceText(ctx: WorkspaceContext): string {
    const commits = ctx.recentCommits.map((c) => `- ${c}`).join("\n") || "- none";
    const docs = Object.entries(ctx.projectDocs)
        .map(([p, content]) => `- ${p}\n${content}`)
        .join("\n") || "- none";
    return [
        `Workspace:`,
        `- cwd: ${ctx.cwd}`,
        `- repo_root: ${ctx.repoRoot}`,
        `- branch: ${ctx.branch}`,
        `- recent_commits:\n${commits}`,
        `- project_docs:\n${docs}`,
    ].join("\n");
}
