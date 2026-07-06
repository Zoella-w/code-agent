import { Document, Chunk } from "./types";

export function loadMarkdown(source: string, rawText: string): Document[] {
    const documents: Document[] = [];
    const sections = rawText.split(/^##\s+(.+)$/gm);
    for (let i = 1; i < sections.length; i += 2) {
        const title = sections[i].trim();
        const content = sections[i + 1]?.trim() || "";
        if (content.length > 0) {
            documents.push({
                pageContent: `## ${title}\n\n${content}`,
                metadata: { source, title },
            });
        }
    }
    return documents;
}

function splitRecursive(text: string, chunkSize: number, overlap: number): string[] {
    const separators = ["\n\n", "\n", "。", "！", "？", "。", " ", ""];
    return splitWithSeparators(text, separators, chunkSize, overlap);
}

function splitWithSeparators(
    text: string,
    separators: string[],
    chunkSize: number,
    overlap: number
): string[] {
    const [sep, ...rest] = separators; // \n\n
    const parts = text.split(sep);
    const chunks: string[] = [];
    for (const part of parts) {
        if (part.length <= chunkSize) {
            // 够小了，直接收
            if (part.trim().length > 0) {
                chunks.push(part);
            }
        } else if (rest.length > 0) {
            // 还太大，用下一层分隔符继续切
            chunks.push(...splitWithSeparators(part, rest, chunkSize, overlap));
        } else {
            // 所有分隔符用完，硬切
            for (let i = 0; i < part.length; i += chunkSize - overlap) {
                const slice = part.slice(i, i + chunkSize);
                chunks.push(slice);
            }
        }
    }
    return chunks;
}

export function splitDocument(doc: Document, chunkSize: number, overlap: number): Chunk[] {
    const texts = splitRecursive(doc.pageContent, chunkSize, overlap);
    return texts.map((text, index) => ({
        id: `${doc.metadata.source}_chunk_${index}`,
        pageContent: text,
        metadata: {
            ...doc.metadata,
            chunkIndex: index,
        },
    }));
}