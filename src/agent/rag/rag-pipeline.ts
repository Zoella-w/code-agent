import { Document, RetrievedChunk, EmbeddingModel, VectorStore } from "./types";
import { splitDocument } from "./document-loader";
import { BM25Retriever } from "./bm25";
import { rrfFusion } from "./hybrid-search";
import { Reranker } from "./rerank";

/**
 * RAG 流水线控制器
 *
 * 不自己干活，只负责按顺序串联各模块。
 * 两个核心方法：
 * - index()：文档 → 切块 → embedding → 存入向量库（离线，只做一次）
 * - query()：问题 → embedding → 检索 → 拼 Prompt → 调 LLM（在线，每次提问触发）
 *
 * 依赖通过 constructor 注入，后续换任何组件（Mock → 真实 Embedding、Mem → Chroma）不改本文件
 */
export class RAGPipeline {
    private embeddingModel: EmbeddingModel; // 抽象接口
    private vectorStore: VectorStore;    // 存储 embedding 向量
    private chunkSize: number;   // 每块最大字符数
    private overlap: number;     // 相邻块重叠字符数
    private chatModel: any;  // LLM 调用函数
    private bm25Retriever?: BM25Retriever;  // 是否用混合检索
    private reranker?: Reranker;            // 是否用 Rerank

    constructor(opts: {
        embeddingModel: EmbeddingModel;
        vectorStore: VectorStore;
        chatModel: (prompt: string) => Promise<string>;
        chunkSize?: number;
        overlap?: number;
        bm25Retriever?: BM25Retriever;
        reranker?: Reranker;
    }) {
        this.embeddingModel = opts.embeddingModel;
        this.vectorStore = opts.vectorStore;
        this.chatModel = opts.chatModel;
        this.chunkSize = opts.chunkSize ?? 800;   // 默认 800 字符/块
        this.overlap = opts.overlap ?? 100;       // 默认重叠 100 字符
        this.bm25Retriever = opts.bm25Retriever;
        this.reranker = opts.reranker;
    }

    /**
     * 索引阶段：把一批文档装入知识库
     * 流程：逐个文档 → 切块 → 批量转向量 → 存入向量库
     * 知识库建好后可以反复 query，不需要重新 index
     */
    async index(documents: Document[]): Promise<void> {
        for (const doc of documents) {
            // 步骤1：按 chunkSize 和 overlap 切成小块
            const chunks = splitDocument(doc, this.chunkSize, this.overlap);

            // 步骤2：提取每块的纯文本，批量转成 Embedding 向量
            const texts = chunks.map((c) => c.pageContent);
            const embeddings = await this.embeddingModel.embedBatch(texts);

            // 步骤3：chunk 和向量一一对应存入向量库
            await this.vectorStore.add(chunks, embeddings);

            // 同步建 BM25 关键词索引
            this.bm25Retriever?.buildIndex(chunks);
        }
    }

    /**
     * 查询阶段：用户提问 → 检索相关文档 → 拼 Prompt → 调 LLM 生成答案
     * 返回答案和引用来源，来源用于展示「这个结论来自哪篇文档」
     */
    async query(question: string, opts?: {
        useHybridSearch?: boolean;
        useRerank?: boolean;
    }): Promise<{ answer: string; sources: RetrievedChunk[] }> {
        // 步骤1：把用户问题也转成向量（和索引用的同一个模型）
        const queryEmbedding = await this.embeddingModel.embed(question);

        let candidates: RetrievedChunk[];
        // 步骤2：检索
        // 混合检索路径
        if (opts?.useHybridSearch && this.bm25Retriever) {
            // 两路并行检索
            const vectorResults = await this.vectorStore.query(queryEmbedding, 50);
            const bm25Results = this.bm25Retriever.search(question, 50);

            // RRF 融合
            const fusedScores = rrfFusion(
                vectorResults.map((r, i) => ({ chunkId: r.id, rank: i + 1, score: r.similarity })),
                bm25Results.map((r, i) => ({ chunkId: r.chunkId, rank: i + 1, score: r.score })),
                60
            );

            // 按 RRF 分数降序取前 50，从 vectorStore 找回完整 Chunk
            const ranked = [...fusedScores.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50);
            const chunkIds = ranked.map(([id]) => id);
            const chunks = await Promise.all(chunkIds.map((id) => this.vectorStore.getChunkById(id)));
            candidates = chunks
                .filter(Boolean)
                .map((chunk) => ({ ...chunk!, similarity: fusedScores.get(chunk!.id) ?? 0 }));
        }
        // 纯向量检索
        else {
            candidates = await this.vectorStore.query(queryEmbedding, 5);
        }

        // 步骤3：Rerank 精排阶段
        if (opts?.useRerank && this.reranker && candidates.length > 5) {
            const rerankInput = candidates.map((c) => ({
                chunk: c,
                originScore: c.similarity,
            }));
            const reranked = await this.reranker.rerank(question, rerankInput, 5);
            candidates = reranked.map((r) => ({
                ...r.chunk,
                similarity: r.originScore,
            }));
        }

        // 步骤4：把检索结果和用户问题拼成结构化的 Prompt
        const prompt = buildPrompt(question, candidates);

        // 步骤5 — 调 LLM 生成答案
        const answer = await this.chatModel(prompt);

        // 返回答案 + 引用来源
        return { answer, sources: candidates };
    }
}

/**
 * 组装 Prompt：检索结果 + 用户问题 → 发给 LLM 的最终提示词
 * 结构：角色设定 → 参考文档（带来源标注）→ 防幻觉规则 → 用户问题
 */
function buildPrompt(question: string, sources: RetrievedChunk[]): string {
    // 每篇检索到的文档标注来源和序号
    const docsText = sources
        .map((s, i) => `### 文档 ${i + 1}（来源：${s.metadata.source}）\n${s.pageContent}`)
        .join("\n\n");

    return [
        "你是一个知识库问答助手。请严格根据以下参考文档回答问题。",
        "",
        "## 参考文档",
        docsText,
        "",
        "## 规则",
        "1. 回答必须基于上述文档，不要编造。",
        "2. 如果文档未覆盖，直接说「文档中未找到相关答案」。",
        "3. 引用时注明来源。",
        "",
        "## 用户问题",
        question,
    ].join("\n");
}