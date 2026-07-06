import { Document, FileParser } from "../multi-format-loader";

export class TextParser implements FileParser {
    supportedExtensions = [".txt", ".md", ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml"];

    async parse(source: string, content: Buffer): Promise<Document[]> {
        // 将 Buffer 转成 UTF-8 字符串
        const text = content.toString("utf-8");
        return [
            {
                pageContent: text,
                metadata: { source, format: "text" },
            },
        ];
    }
}