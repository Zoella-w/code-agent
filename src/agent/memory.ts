import crypto from "crypto";
import { Message, ModelClient } from "./react-runtime";

export class ConversationMemory {
    private messages: Message[];

    constructor(systemPrompt: string, userMessage: string) {
        this.messages = [{
            role: "system",
            content: systemPrompt
        }, {
            role: "user",
            content: userMessage
        }];
    }

    /** 添加一条消息 */
    add(message: Message): void {
        this.messages.push(message);
    }

    /** 获取原始消息列表，供 ContextManager 使用 */
    getAllMessages(): Message[] {
        return this.messages;
    }
}

/** 简单 token 估算：中英混用 chars/3 折中，每条消息 +4 开销 */
export function estimateTokens(messages: Message[]): number {
    // 遍历 messages，累加每条消息的 token 数
    let tokenCount = 0;
    messages.forEach((m: Message) => {
        tokenCount += m.content.length / 3 + 4;
    });
    // 返回 Math.ceil(总数)
    return Math.ceil(tokenCount);
}

/** 从尾部往前累加 token，返回 { keep（system + 首条用户消息 + 尾部）, toDrop（中间丢弃部分） } */
function splitMessages(messages: Message[], maxTokens: number): { keep: Message[]; toDrop: Message[] } {
    const pinned = [messages[0], messages[1]];  // system + 用户首条消息永远保留
    const keep: Message[] = [];
    let tokens = estimateTokens(pinned);

    // 从尾部往前扫，能塞进 maxTokens 的都保留
    for (let i = messages.length - 1; i >= 2; i--) {
        const msgTokens = estimateTokens([messages[i]]);
        if (tokens + msgTokens <= maxTokens) {
            keep.unshift(messages[i]);
            tokens += msgTokens;
        } else {
            break;
        }
    }

    const keepSet = new Set(keep);
    const toDrop = messages.slice(2).filter(m => !keepSet.has(m));

    return { keep: [...pinned, ...keep], toDrop };
}

/** 对被截断的消息生成摘要，保留任务目标和关键发现 */
export async function summarizeMessages(
    toDrop: Message[],
    model: ModelClient  // ModelClient，先 any 占位
): Promise<string> {
    // 1. 如果 toDrop 为空，返回空串
    if (!toDrop || toDrop.length === 0) {
        return "";
    }
    // 2. 组装一个 prompt："请用 2-3 句话总结以下对话的关键信息，包括用户的目标和已发现的重要事实："
    // 3. 把 toDrop 的内容拼在 prompt 后面
    const historyText = toDrop.map(m => `[${m.role}]: ${m.content}`).join("\n");
    const prompt: Message[] = [{
        role: "user",
        content: `请用 2-3 句话总结以下对话的关键信息，包括用户的目标和已发现的重要事实：\n\n${historyText}`
    }];
    // 4. 调用 model.chat() 获取摘要
    let summary = await model.chat(prompt);
    // 5. 返回摘要文本
    return summary;
}

/** 计算文本内容的 SHA256 指纹 */
function sha256(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex");
}

export class FileSummaryStore {
    private cache = new Map<string, { hash: string; summary: string }>();

    /** 存储文件摘要（同时记录内容 hash，用于 freshness 校验） */
    set(filePath: string, content: string, summary: string): void {
        const hash = sha256(content);
        this.cache.set(filePath, { hash, summary });
    }

    /** 获取文件摘要。返回 null 表示：无缓存 / 文件已变更（hash 不匹配） */
    get(filePath: string, currentContent: string): string | null {
        const entry = this.cache.get(filePath);
        if (!entry) return null;
        const currentHash = sha256(currentContent);
        if (entry.hash !== currentHash) return null;
        return entry.summary;
    }

    /** 标记文件为 stale（强制下次重新读取） */
    invalidate(filePath: string): void {
        this.cache.delete(filePath);
    }
}