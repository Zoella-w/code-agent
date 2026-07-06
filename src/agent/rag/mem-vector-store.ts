import { Chunk, RetrievedChunk, VectorStore } from "./types";

/** 存储条目：chunk 和它的 embedding 向量 */
interface Entry {
    chunk: Chunk;
    embedding: number[];
}

export class MemVectorStore implements VectorStore {
    private entries: Entry[] = [];

    async clear(): Promise<void> {
        this.entries = [];
    }

    async add(chunks: Chunk[], embeddings: number[][]): Promise<void> {
        for (let i = 0; i < chunks.length; i++) {
            this.entries.push({
                chunk: chunks[i],
                embedding: embeddings[i],
            });
        }
    }

    async query(queryEmbedding: number[], topK: number): Promise<RetrievedChunk[]> {
        if (this.entries.length === 0) return [];

        const scored = this.entries.map((entry) => ({
            entry,
            similarity: cosineSimilarity(queryEmbedding, entry.embedding),
        }));

        scored.sort((a, b) => b.similarity - a.similarity);  // 降序

        return scored.slice(0, topK).map((s) => ({
            ...s.entry.chunk,
            similarity: s.similarity,
        }));
    }

    /** 获取所有 chunk，供 BM25 构建索引用 */
    async getAllChunks(): Promise<Chunk[]> {
        return this.entries.map((e) => e.chunk);
    }

    /** 按 ID 查询单个 chunk，RRF 融合后用 chunkId 找回完整 Chunk 对象 */
    async getChunkById(id: string): Promise<Chunk | undefined> {
        return this.entries.find((e) => e.chunk.id === id)?.chunk;
    }
}


/** 计算两个向量的余弦相似度，范围 [-1, 1]，值越大越相似 */
function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}