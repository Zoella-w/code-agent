import { Document, FileParser } from "../multi-format-loader";

export class PDFParser implements FileParser {
    supportedExtensions = [".pdf"];

    async parse(source: string, content: Buffer): Promise<Document[]> {
        // pdf-parse 是第三方库，需要 npm install pdf-parse
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(content);
        const text = data.text as string;
        if (!text || text.trim().length === 0) {
            throw new Error(`PDF 解析结果为空（来源: ${source}），可能是扫描件`);
        }
        return [
            {
                pageContent: text,
                metadata: { source, format: "pdf", pageCount: data.numpages },
            },
        ];
    }
}