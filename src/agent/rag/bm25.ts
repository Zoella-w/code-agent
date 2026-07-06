import { Chunk } from "./types";

export interface BM25Result {
    chunkId: string;
    score: number;
}

/** BM25 关键词检索器：词频统计 + IDF + 文档长度归一化 */
export class BM25Retriever {
    private chunks: Chunk[] = [];
    // key: chunkId, value: 该 chunk 分词后的 token 列表
    private docTokens: Map<string, string[]> = new Map();
    // key: term, value: 该 term 的 IDF 值（一个词是否稀有）
    private idf: Map<string, number> = new Map();
    // 所有文档的平均 token 数量
    private avgDocLength = 0;
    // BM25 参数：控制词频饱和（一个词出现 100 次 vs 10 次，不会差 10 倍）
    private k1 = 1.5;
    // BM25 参数：控制文档长度归一化强度（0 = 不看长度，1 = 完全归一化）
    private b = 0.75;

    /** 从 chunks 构建索引：分词 → 统计文档频率（DF） → 算 IDF → 算平均文档长度 */
    buildIndex(chunks: Chunk[]): void {
        this.chunks = chunks;
        // 清空上次索引的数据
        this.docTokens.clear();
        this.idf.clear();

        // 算 avgDocLen 需要：所有文档 token 数的总和
        let totalLength = 0;
        for (const chunk of chunks) {
            // 拆词，并把结果存起来：chunk_id 及其对应的 token 列表
            // 查询时某个词在这篇文档里出现了几次（TF），直接数这个数组
            const tokens = tokenize(chunk.pageContent);
            this.docTokens.set(chunk.id, tokens);

            // 累加，最后除以 N 得到 avgDocLen，给文档长度修正用
            totalLength += tokens.length;

            // 去重，这里数的是"多少个文档包含这个词"，不是"出现了多少次"
            const uniqueTerms = new Set(tokens);
            for (const term of uniqueTerms) {
                // 每遇到一个包含该词的文档就 +1
                // 循环结束后 idf["fiber"] = 包含 "fiber" 的文档数
                // 注意：现在存的是 DF（文档频率），下一步才转成真正的 IDF
                this.idf.set(term, (this.idf.get(term) ?? 0) + 1);
            }
        }

        // 把 DF 转成真正的 IDF：词越稀有，IDF 越高
        const N = chunks.length;
        for (const [term, df] of this.idf) {
            this.idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
        }

        // 所有文档的平均 token 数量，查询时用来做长度修正
        this.avgDocLength = N > 0 ? totalLength / N : 0;
    }

    /**
     * 查询：接收用户输入的一句话，返回最相关的 topK 个 chunk 及其分数
     *
     * 流程：
     *   1. 把用户查询也拆成 token 列表（和建索引时用同一个 tokenize）
     *   2. 遍历知识库中的每一个 chunk，逐一用 scoreDoc 算分
     *   3. 过滤掉分数为 0 的（没有任何 token 命中）
     *   4. 按分数降序排列，取前 topK 个返回
     */
    search(query: string, topK: number): BM25Result[] {
        // 把用户输入的查询也拆成 token 列表
        const queryTokens = tokenize(query);
        const scores: BM25Result[] = [];

        // 遍历知识库中的每一个 chunk，逐一算分
        for (const chunk of this.chunks) {
            // 取出 buildIndex 阶段存好的完整 token 列表（未去重，用于算 TF）
            const docToks = this.docTokens.get(chunk.id);
            // 空文档跳过
            if (!docToks || docToks.length === 0) continue;

            // 对这个 chunk 算 BM25 分数
            const score = this.scoreDoc(queryTokens, docToks);
            // 分数 > 0 才保留，0 意味着没有任何查询词在文档中出现
            if (score > 0) {
                scores.push({ chunkId: chunk.id, score });
            }
        }

        // 按分数降序排列，最相关的文档排最前面
        scores.sort((a, b) => b.score - a.score);
        // 只返回最靠前的 topK 个结果
        return scores.slice(0, topK);
    }

    /**
     * 对一篇文档计算 BM25 分数
     *
     * 公式：
     *   BM25(d, q) = Σ IDF(t) × (tf × (k1 + 1)) / (tf + k1 × (1 - b + b × docLen / avgDocLen))
     *
     * 分层理解：
     *   IDF(t)    — 这个词有多稀有？越稀有值越大。在 buildIndex 里已经算好存在 this.idf 里
     *   tf        — 这个词在这篇文档里出现了几次
     *   k1        — 饱和参数（1.5），控制 tf 增长上限：出现 100 次和 10 次不会差 10 倍
     *   b         — 长度归一化强度（0.75），长文档天然词多，需要打折
     *   docLen    — 当前文档的 token 数
     *   avgDocLen — 所有文档的平均 token 数，作为长度参考基准
     *
     * 分母中的 (1 - b + b × docLen / avgDocLen) 是长度修正因子：
     *   - docLen === avgDocLen → 因子为 1，无修正
     *   - docLen < avgDocLen  → 因子 < 1 → 分母变小 → 分数变高（短文档加分）
     *   - docLen > avgDocLen  → 因子 > 1 → 分母变大 → 分数打折（长文档打折）
     */
    private scoreDoc(queryTokens: string[], docTokens: string[]): number {
        // 先统计这篇文档里每个词出现几次（TF = Term Frequency）
        // 用 Map 缓存，避免内层循环对同一个查询词重复遍历文档的 token 列表
        const tfMap = new Map<string, number>();
        for (const t of docTokens) {
            tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
        }
        const docLen = docTokens.length;
        let total = 0;
        // 对查询中的每个词，计算它对这篇文档的贡献分
        for (const qt of queryTokens) {
            const tf = tfMap.get(qt) ?? 0;  // 这个词在这篇文档里出现了几次
            if (tf === 0) continue;          // 没出现，贡献为 0，跳过
            const idf = this.idf.get(qt) ?? 0;

            // 分子：tf × (k1 + 1)，tf 越大分子越大，但分母也会跟着变大 -> 饱和效果
            const numerator = tf * (this.k1 + 1);
            // 分母 = tf + k1 × 长度修正因子
            const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));

            // 这个词的贡献 = 稀有度（IDF）× 词频（TF 饱和版）
            total += idf * (numerator / denominator);
        }
        return total;
    }
}


/**
* 分词：把一段文字拆成可检索的 token 列表。
* 英文按词拆（"react fiber" → ["react", "fiber"]），
* 中文按单字拆（"架构" → ["架", "构"]），因为中文词之间没有空格。
*/
function tokenize(text: string): string[] {
    // 结果数组：用来装切好的 token
    const tokens: string[] = [];
    // 正则：匹配「连续英文/数字」或「单个中文字」
    const regex = /[a-z0-9]+|[\u4e00-\u9fff]/g;
    // exec() 每次调用返回的下一个匹配结果（没得匹配时返回 null）
    let match: RegExpExecArray | null;
    // 统一转小写
    const lower = text.toLowerCase();

    // 内部有个游标记录"上次匹配到哪了"，每次调用从游标位置继续往后找
    // 每找到一个游标就往前走，找不到时返回 null 退出循环
    while ((match = regex.exec(lower)) !== null) {
        // match[0] 是本次匹配到的文字，比如 "react" 或 "架"
        tokens.push(match[0]);
    }
    // 过滤掉可能出现的空字符串，返回最终结果
    return tokens.filter((t) => t.length > 0);
}