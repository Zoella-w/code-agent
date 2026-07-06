// 修复循环依赖
import type { Message, ModelClient } from "./react-runtime";

/** 一轮对话：一条模型输出 + 紧跟着的一条 observation（可能为空） */
interface Round {
    /** 模型输出或孤立的 user 消息（如 parse_error 重试提示） */
    output: Message;
    /** 紧跟在 output 后面的 observation，没有则为 null */
    observation: Message | null;
}

/** 将消息列表按 output → observation 配对分组 */
function groupIntoRounds(messages: Message[]): Round[] {
    const rounds: Round[] = [];
    let i = 0;
    while (i < messages.length) {
        if (messages[i].role === "assistant") {
            const output = messages[i];
            const next = messages[i + 1];
            const observation = (next && next.role === "user") ? next : null;
            rounds.push({ output, observation });
            i += observation ? 2 : 1;
        } else {
            // 孤立的 user 消息（如 parse_error 重试提示），没有 observation
            rounds.push({ output: messages[i], observation: null });
            i++;
        }
    }
    return rounds;
}

/** 默认 token 预算上限（参考 pico DEFAULT_TOTAL_BUDGET=12000 字符，换算约 4000 tokens） */
const DEFAULT_TOTAL_BUDGET = 4000;

/** 做三层裁剪的入口类 */
export class ContextManager {
    private model: ModelClient;
    private recentRounds: number;
    private midRounds: number;
    private totalBudget: number;
    private summaryCache = new Map<string, string>();
    /** 最近一次 build() 的裁剪统计（公开，供 API 返回面试数据） */
    public lastStats: { before: number; after: number; rounds: number; compressed: boolean } | null = null;

    constructor(
        model: ModelClient,
        recentRounds: number = 3,
        midRounds: number = 3,
        totalBudget: number = DEFAULT_TOTAL_BUDGET,
    ) {
        this.model = model;
        this.recentRounds = recentRounds;
        this.midRounds = midRounds;
        this.totalBudget = totalBudget;
    }

    /** 对消息列表做三层渐进压缩（只有超过 token 预算时才触发，参考 pico while len(prompt) > total_budget） */
    async build(messages: Message[]): Promise<Message[]> {
        const beforeTokens = estimateTokensForMessages(messages);

        // 未超过预算 → 不压缩，原样返回
        if (beforeTokens <= this.totalBudget) {
            this.lastStats = { before: beforeTokens, after: beforeTokens, rounds: 0, compressed: false };
            return messages;
        }

        // 固定保留 system + 首条 user
        const pinned = [messages[0], messages[1]];
        const rounds = groupIntoRounds(messages.slice(2));

        const total = rounds.length;
        // 从后往前：最近 recentRounds 轮是近期，再往前 midRounds 轮是中期，其余是远期
        const recentStart = Math.max(0, total - this.recentRounds);
        const midStart = Math.max(0, total - this.recentRounds - this.midRounds);

        const result: Message[] = [...pinned];
        for (let i = 0; i < total; i++) {
            const round = rounds[i];
            // 近期 — 完整保留
            if (i >= recentStart) {
                result.push(round.output);
                if (round.observation) result.push(round.observation);
            }
            // 中期 — 截断 observation
            else if (i >= midStart) {
                result.push(round.output);
                if (round.observation) {
                    // 把前缀 “Observation:” 剥掉
                    const rawObs = round.observation.content.replace(/^Observation:\s*/i, "");
                    // 截断到 150 字符 + 重新包上 "Observation:" 前缀
                    result.push({
                        role: "user" as const,
                        content: `Observation: ${truncateObservation(rawObs, 150)}`,
                    });
                }
            }
            // 远期 — LLM 生成一句话摘要
            else {
                // 如果这一轮有 observation（工具执行结果），才需要生成摘要。
                if (round.observation) {
                    const cacheKey = round.output.content;
                    // 用 assistant 输出的原文作为「钥匙」查缓存
                    let summary = this.summaryCache.get(cacheKey);
                    // 从 Map 里查：这把钥匙之前有没有生成过摘要？
                    if (!summary) {
                        // 没缓存 → 调 LLM 生成一句话摘要
                        summary = await this.summarizeRound(round.output, round.observation);
                        // 把结果存进 Map，下次遇到同样的 output 直接用
                        this.summaryCache.set(cacheKey, summary);
                    }
                    // 把摘要包装成一条 user 消息塞进结果列表
                    result.push({
                        role: "user",
                        content: `[历史步骤摘要] ${summary}`,
                    });
                }
            }
        }
        // 裁剪后的 token
        const afterTokens = estimateTokensForMessages(result);
        this.lastStats = { before: beforeTokens, after: afterTokens, rounds: total, compressed: true };
        return result;
    }

    /** 调 LLM 将一轮对话压缩为一句话 */
    private async summarizeRound(output: Message, observation: Message): Promise<string> {
        const prompt: Message[] = [{
            role: "user",
            content:
                `用一句话（不超过30字）总结以下 Agent 步骤做了什么、发现了什么：\n\n` +
                `助手输出: ${output.content.slice(0, 300)}\n` +
                `观察结果: ${observation.content.slice(0, 300)}`,
        }];
        const result = await this.model.chat(prompt);
        return result.trim();
    }
}

/** 估算消息列表的 token 数，区分中英文（中文 ~1.5 字符/token，英文 ~4 字符/token），每条消息 +4 开销 */
export function estimateTokensForMessages(messages: Message[]): number {
    let total = 0;
    for (const m of messages) {
        const chineseChars = (m.content.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = m.content.length - chineseChars;
        total += Math.ceil(chineseChars / 1.5 + otherChars / 4) + 4;
    }
    return total;
}

/** 截断 observation 文本到指定长度，保留头部 70% + 尾部 30% */
function truncateObservation(text: string, maxChars: number = 150): string {
    if (text.length <= maxChars) return text;
    const headSize = Math.floor(maxChars * 0.7);
    const tailSize = maxChars - headSize;
    return text.slice(0, headSize) + `\n... [截断 ${text.length - maxChars} 字符] ...\n` + text.slice(-tailSize);
}