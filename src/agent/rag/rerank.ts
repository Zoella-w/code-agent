import { Chunk } from "./types";

export interface RerankCandidate {
    chunk: Chunk;
    originScore: number; // 上一阶段的分数
}

export interface Reranker {
    rerank(query: string, candidates: RerankCandidate[], topN: number): Promise<RerankCandidate[]>;
}

/** Mock 版本：直接保留原排序，不做精排。后续可替换为 Cohere API / bge-reranker */
export class MockReranker implements Reranker {
    async rerank(_query: string, candidates: RerankCandidate[], topN: number): Promise<RerankCandidate[]> {
        return candidates.slice(0, topN);
    }
}