import { Document, FileParser, getExtension } from "../multi-format-loader";

/** 图片解析器 — 当前为占位实现，仅提取元信息作为描述 */
export class ImageParser implements FileParser {
    supportedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];

    async parse(source: string, content: Buffer): Promise<Document[]> {
        // 占位：用文件名和大小做描述，真正的 OCR/Vision 作为后续可插拔策略接入
        const sizeKB = (content.length / 1024).toFixed(1);
        const fileName = source.split("/").pop() || source;
        return [
            {
                pageContent: `[图片文件] 文件名: ${fileName}, 大小: ${sizeKB}KB, 格式: ${getExtension(source)}`,
                metadata: { source, format: "image", fileSize: content.length },
            },
        ];
    }
}
