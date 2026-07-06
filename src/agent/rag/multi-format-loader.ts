import { Document } from "./types";
export type { Document } from "./types";

/** 文件解析器接口 — 每种格式实现自己的 parse 方法 */
export interface FileParser {
    /** 这个 parser 能处理的扩展名列表，如 ['.pdf', '.PDF'] */
    supportedExtensions: string[];
    /** 解析文件内容，返回统一 Document[] */
    parse(source: string, content: Buffer): Promise<Document[]>;
}

/** 从小写扩展名匹配 parser */
export function getExtension(filePath: string): string {
    const match = filePath.match(/\.([a-zA-Z0-9]+)$/);
    return match ? `.${match[1].toLowerCase()}` : "";
}

/** 多格式 Loader — 根据扩展名路由到对应 Parser，输出统一 Document[] */
export class MultiFormatLoader {
    // 存储：扩展名 → Parser 的映射，如 '.pdf' → PDFParser
    private parsers: Map<string, FileParser> = new Map();

    /**
     * 注册一个 Parser 到 Loader 中
     * 例：loader.register(new PDFParser())
     * PDFParser 的 supportedExtensions 是 ['.pdf']，
     * 所以 map 里会新增 '.pdf' → PDFParser
     */
    register(parser: FileParser): void {
        for (const ext of parser.supportedExtensions) {
            this.parsers.set(ext, parser);
        }
    }

    /**
     * 加载一个文件，内部逻辑：
     * 1. 提取扩展名
     * 2. 在 map 里找对应的 Parser
     * 3. 调 Parser.parse()，返回统一的 Document[]
     */
    async load(source: string, content: Buffer): Promise<Document[]> {
        const ext = getExtension(source);        // 如 'src/utils.ts' → '.ts'
        const parser = this.parsers.get(ext);   // 如 '.ts' → TextParser
        if (!parser) {
            // 没注册过的格式，比如 '.psd'
            throw new Error(`不支持的文件格式: ${ext}（来源: ${source}）`);
        }
        return parser.parse(source, content);   // 交给具体 Parser 处理
    }
}