import { NextRequest, NextResponse } from "next/server";
import { MemVectorStore } from "@/agent/rag/mem-vector-store";
import { RAGPipeline } from "@/agent/rag/rag-pipeline";
import { AnthropicModelClient } from "@/agent/model-client";
import { MultiFormatLoader } from "@/agent/rag/multi-format-loader";
import { TextParser } from "@/agent/rag/parsers/text-parser";
import { ImageParser } from "@/agent/rag/parsers/image-parser";
import { SiliconFlowEmbedding } from "@/agent/rag/siliconflow-embedding";

export async function POST(request: NextRequest) {
  try {
    const { files, question } = await request.json();

    // 多格式 Loader 注册所有 Parser
    const loader = new MultiFormatLoader();
    loader.register(new TextParser());
    loader.register(new ImageParser());

    // 逐文件解析成 Document[]
    const documents: any[] = [];
    for (const f of files) {
      const content = Buffer.from(f.content, "utf-8");
      const docs = await loader.load(f.source, content);
      documents.push(...docs);
    }

    // 真实 Embedding 替换 Mock
    const pipeline = new RAGPipeline({
      embeddingModel: new SiliconFlowEmbedding(),
      vectorStore: new MemVectorStore(),
      chatModel: async (prompt: string) => {
        const model = new AnthropicModelClient();
        return await model.chat([{ role: "user" as const, content: prompt }]);
      },
    });

    // 使用真实 Embedding 对 documents 进行索引
    await pipeline.index(documents);

    // 查询
    const { answer, sources } = await pipeline.query(question);
    return NextResponse.json({
      answer,
      sources: sources.map((s) => ({
        source: s.metadata.source,
        similarity: s.similarity,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
