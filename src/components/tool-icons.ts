export interface ToolMeta {
    emoji: string;
    label: string;
}

const TOOL_META: Record<string, ToolMeta> = {
    read_file: { emoji: "📖", label: "读取文件" },
    search_code: { emoji: "🔍", label: "搜索代码" },
    list_directory: { emoji: "📂", label: "列出目录" },
    write_file: { emoji: "✍️", label: "写入文件" },
    analyze_code: { emoji: "🧠", label: "分析代码" },
};

/** 根据工具名获取元信息，未匹配时返回原始名称 */
export function getToolMeta(toolName: string): ToolMeta {
    return TOOL_META[toolName] ?? { emoji: "🔧", label: toolName };
}

/** 将 args 格式化为简短摘要文本 */
export function formatArgs(args: Record<string, unknown>): string {
    const path = args.path ?? args.filePath ?? args.file;
    if (typeof path === "string") return path;
    const query = args.query ?? args.keyword ?? args.search;
    if (typeof query === "string") return query;
    const snippet = args.snippet;
    if (typeof snippet === "string") return snippet.slice(0, 40) + (snippet.length > 40 ? "…" : "");
    return "";
}
