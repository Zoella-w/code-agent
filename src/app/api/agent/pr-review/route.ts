import { NextRequest } from "next/server";
import { createOrchestrateStream } from "@/agent/orchestrate";

export async function POST(request: NextRequest) {
    const { prUrl, githubToken, verify } = await request.json();

    if (!prUrl || typeof prUrl !== "string") {
        return new Response(JSON.stringify({ error: "prUrl 为必填字段" }), { status: 400 });
    }

    /** 从 PR URL 拼出 .diff 地址 */
    const diffUrl = prUrl.replace(/\/$/, "") + ".diff";

    const headers: Record<string, string> = {};
    if (githubToken) {
        headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const diffRes = await fetch(diffUrl, { headers });

    if (diffRes.status === 404) {
        return new Response(
            JSON.stringify({ error: "PR 地址无效，请检查" }),
            { status: 400 },
        );
    }
    if (diffRes.status === 401) {
        return new Response(
            JSON.stringify({
                error: githubToken ? "Token 无效或已过期" : "此仓库为私有，请输入 GitHub Token",
            }),
            { status: 401 },
        );
    }
    if (diffRes.status === 403) {
        return new Response(
            JSON.stringify({
                error: githubToken ? "Token 无权访问此仓库" : "此仓库为私有，请输入 GitHub Token",
            }),
            { status: 403 },
        );
    }
    if (!diffRes.ok) {
        return new Response(JSON.stringify({ error: "拉取 PR diff 失败，请重试" }), { status: 500 });
    }

    const diff = await diffRes.text();

    const reviewPrompt = [
        "## 任务",
        "对以下 GitHub PR 的代码变更做安全审查。逐条检查 diff 中新增或修改的代码，检测：",
        "1. 安全漏洞（SQL注入、XSS、敏感信息泄露等）",
        "2. 性能瓶颈",
        "3. 代码异味",
        "## PR Diff",
        diff,
    ].join("\n");

    const stream = createOrchestrateStream({
        prompt: reviewPrompt,
        mode: "react",
        verify: verify ?? false,
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
