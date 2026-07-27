import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { prUrl, reviewText, githubToken } = await request.json();

        if (!prUrl || !reviewText || !githubToken) {
            return NextResponse.json(
                { error: "prUrl / reviewText / githubToken 为必填字段" },
                { status: 400 },
            );
        }

        const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
        if (!match) {
            return NextResponse.json({ error: "PR 地址格式无效" }, { status: 400 });
        }
        const [, owner, repo, prNumber] = match;

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
        const res = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Content-Type": "application/json",
                "Accept": "application/vnd.github+json",
            },
            body: JSON.stringify({ body: reviewText }),
        });

        if (!res.ok) {
            const msg =
                res.status === 401 ? "Token 无效"
                : res.status === 403 ? "Token 无评论权限"
                : "发布失败";
            return NextResponse.json({ error: msg }, { status: res.status });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "发布评论失败" }, { status: 500 });
    }
}
