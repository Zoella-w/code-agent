import { prisma } from "@/lib/prisma";

/** 每台设备（按 IP 计）允许的 LLM 请求次数 */
export const USAGE_LIMIT = 3;
/** 前端识别限流命中的错误码（后端与 useAgent 两端字符串常量保持一致） */
export const USAGE_ERROR_CODE = "USAGE_LIMIT_REACHED";
export const USAGE_MESSAGE = "个人 DEMO，体验次数已用完，继续使用请联系作者";

/** 从请求头解析客户端 IP：Vercel 的 x-forwarded-for 逗号分隔，取第一个真实 IP */
function getClientIp(req: Request): string {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    return req.headers.get("x-real-ip") ?? "unknown";
}

/** 设备维度没有可靠标识，个人 demo 用 IP 做硬闸（localStorage 可清、指纹可伪，IP 无法绕过）。
 *  注意：同一 NAT 下多用户共享 IP 会共享额度——个人 demo 可接受的取舍。
 *  调用时机：真正发起 LLM 请求之前（PR 场景在拉 diff 成功之后），只给烧钱的请求计数。 */
export async function checkAndConsumeUsage(
    req: Request,
): Promise<{ allowed: boolean; remaining: number }> {
    // 作者豁免：请求带 x-demo-owner 且匹配 env 密钥 → 放行且不计数，方便作者自测
    const secret = process.env.DEMO_OWNER_SECRET;
    if (secret && req.headers.get("x-demo-owner") === secret) {
        return { allowed: true, remaining: Number.POSITIVE_INFINITY };
    }

    const key = `ip:${getClientIp(req)}`;

    try {
        // upsert 原子自增：POSTGRES RETURNING 返回自增后的 count，并发请求各自拿到递增后的值，第 4 个被拒
        const row = await prisma.usageLimit.upsert({
            where: { key },
            create: { key, count: 1 },
            update: { count: { increment: 1 } },
        });
        const remaining = Math.max(0, USAGE_LIMIT - row.count);
        return { allowed: remaining > 0, remaining };
    } catch (err) {
        // DB 故障时 fail-open（放行），避免 demo 因数据库抖动直接不可用；前端 localStorage 计数仍兜底
        console.error("[usage-limit] DB error, fail open:", err);
        return { allowed: true, remaining: Number.POSITIVE_INFINITY };
    }
}
