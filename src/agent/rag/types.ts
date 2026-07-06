/** 文档加载后的原始文档 */
export interface Document {
  pageContent: string;
  metadata: {
    source: string;      // 文件路径或 URL
    [key: string]: any;  // 页码或标题 等索引
  };
}

/** 切分后的文档块 */
export interface Chunk {
  id: string;          // 唯一标识，如 "doc1_chunk_3"
  pageContent: string;
  metadata: {
    source: string;    // 继承自原始 Document
    chunkIndex: number;
    [key: string]: any;
  };
}

/** 检索结果 */
export interface RetrievedChunk extends Chunk {
  similarity: number;  // 余弦相似度，范围 -1 到 1
}

/** Embedding 模型的抽象接口（先 mock 实现，后续换真实模型） */
export interface EmbeddingModel {
  /** 将文本转为向量 */
  embed(text: string): Promise<number[]>;
  /** 批量转换 */
  embedBatch(texts: string[]): Promise<number[][]>;
}

/** 向量存储的抽象接口 */
export interface VectorStore {
  /** 添加文档块及其向量 */
  add(chunks: Chunk[], embeddings: number[][]): Promise<void>;
  /** 用查询向量检索 Top-K 个最相似的 chunk */
  query(queryEmbedding: number[], topK: number): Promise<RetrievedChunk[]>;
  /** 清空存储 */
  clear(): Promise<void>;
  /** 按 ID 查询单个 chunk */
  getChunkById(id: string): Promise<Chunk | undefined>;
}
