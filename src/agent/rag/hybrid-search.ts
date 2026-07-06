export interface RankedDoc {
    chunkId: string;
    rank: number;  // 1-based
    score: number; // 原始分数，仅 trace 用
}

/**
   * RRF（Reciprocal Rank Fusion）倒数排名融合
   *
   * 把两个检索器的排序结果合并成一份，不看原始分数只看排名。
   * 公式：RRF_score(chunk) = 1 / (k + rank)
   *
   * k = 60 使第 1 名和第 10 名不会差距过大。
   * 同一个 chunk 在两个检索器都出现 → 分数叠加 → 奖励共识。
   */
export function rrfFusion(
    resultsA: RankedDoc[],
    resultsB: RankedDoc[],
    k: number = 60
): Map<string, number> {
    const scores = new Map<string, number>();

    // 按排名算分：rank 越靠前（i 越小），分数越高
    for (let i = 0; i < resultsA.length; i++) {
        const rrfScore = 1 / (k + i + 1);
        scores.set(resultsA[i].chunkId, rrfScore);
    }

    // 第二个检索器同理，同 chunk 分数叠加
    for (let i = 0; i < resultsB.length; i++) {
        const rrfScore = 1 / (k + i + 1);
        const current = scores.get(resultsB[i].chunkId) ?? 0;
        scores.set(resultsB[i].chunkId, current + rrfScore);
    }
    return scores;
}
