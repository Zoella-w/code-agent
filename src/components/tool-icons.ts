import { FileText, Search, FolderOpen, FilePen, Brain, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ToolMeta {
  icon: LucideIcon;
  label: string;
}

const TOOL_META: Record<string, ToolMeta> = {
  read_file: { icon: FileText, label: "读取文件" },
  search_code: { icon: Search, label: "搜索代码" },
  list_directory: { icon: FolderOpen, label: "列出目录" },
  write_file: { icon: FilePen, label: "写入文件" },
  analyze_code: { icon: Brain, label: "分析代码" },
};

/** 根据工具名获取元信息，未匹配时回退到通用扳手 icon */
export function getToolMeta(toolName: string): ToolMeta {
  return TOOL_META[toolName] ?? { icon: Wrench, label: toolName };
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
