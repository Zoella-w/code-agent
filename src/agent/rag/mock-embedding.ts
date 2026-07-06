import { EmbeddingModel } from "./types";

export class MockEmbeddingModel implements EmbeddingModel {
    async embed(text: string): Promise<number[]> {
        return hashToVector(text);
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        return texts.map((t) => hashToVector(t));
    }
}

/** 将字符串转为 384 维浮点数向量，相同文本始终产出相同向量 */
function hashToVector(text: string, dims: number = 384): number[] {
    const vector: number[] = [];
    const baseHash = hashString(text);
    for (let i = 0; i < dims; i++) {
        const v = Math.sin(baseHash + i * 31) * 10000;
        vector[i] = (v - Math.floor(v));  // 取小数部分 → [0, 1)
    }
    return normalize(vector);
}


/** DJB2 字符串哈希，相同文本得相同数字 */
function hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return hash;
}

/** 将向量归一化到单位长度，使余弦相似度计算正确 */
function normalize(vector: number[]): number[] {
    const sumSq = vector.reduce((sum, v) => sum + v * v, 0);
    const len = Math.sqrt(sumSq);
    if (len === 0) return vector;
    return vector.map((v) => v / len);
}