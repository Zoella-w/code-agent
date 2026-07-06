import { EmbeddingModel } from "./types";

export class SiliconFlowEmbedding implements EmbeddingModel {
    private apiKey: string;
    private baseURL: string;
    private model: string;

    constructor(opts?: {
        apiKey?: string;
        baseURL?: string;
        model?: string;
    }) {
        this.apiKey = opts?.apiKey ?? process.env.SILICONFLOW_API_KEY ?? "";
        this.baseURL = opts?.baseURL ?? "https://api.siliconflow.cn/v1";
        this.model = opts?.model ?? "BAAI/bge-m3";
    }

    async embed(text: string): Promise<number[]> {
        const embeddings = await this.embedBatch([text]);
        return embeddings[0];
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        // SiliconFlow embedding API 兼容 OpenAI 格式
        const res = await fetch(`${this.baseURL}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,   // 如 "BAAI/bge-m3"
                input: texts,        // 批量子符串数组，一次最多 32 条
            }),
        });
        // 网络或鉴权失败时抛出明确错误
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`SiliconFlow Embedding 失败: ${res.status} ${body}`);
        }
        // 返回格式：{ data: [{ embedding: [0.23, -0.01, ...] }, { embedding: [...]}, ...] }
        const json = await res.json();
        return json.data.map((d: any) => d.embedding as number[]);
    }
}