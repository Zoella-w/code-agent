import * as fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { Tool, ToolRegistry } from "./tools";
import { validatePath } from "./tool-executor";
import type { ModelClient } from "./model-client";

export const readFileTool: Tool = {
    schema: {
        name: "read_file",
        description: "读取指定文件的全部或部分内容。返回带行号的文本。",
        parameters: {
            path: {
                type: "string",
                description: "文件路径，可以是相对路径或绝对路径"
            },
            startLine: {
                type: "number",
                description: "起始行号（1-indexed，包含）"
            },
            endLine: {
                type: "number",
                description: "结束行号（1-indexed，包含）"
            }
        },
        required: ["path"]
    },
    execute: async (args) => {
        // 1. 校验 path（已有）
        if (!args.path || typeof args.path !== "string") {
            return "错误：缺少必填参数 path，或 path 类型不是 string";
        }

        // 3. 安全检查：防止读取项目目录之外的文件
        // 路径校验由 validatePath 统一处理，越界会抛错，由上层 catch 捕获
        const filePath = validatePath(args.path as string);


        // 4. 读文件 + 错误处理
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            // 处理按行切片和行号
            // 按行拆分
            const lines = content.split("\n");

            // 处理行号范围（1-indexed，跟编辑器一致）
            const start = typeof args.startLine === "number" ? args.startLine : 1;
            const end = typeof args.endLine === "number" ? args.endLine : lines.length;

            // 校验范围
            if (start < 1 || end < start) {
                return `错误：行号范围不合法 - startLine=${start}, endLine=${end}`;
            }

            // 切片 + 加行号
            // start - 1：把用户 1-indexed 转成数组 0-indexed
            const sliced = lines.slice(start - 1, end);
            const numbered = sliced
                .map((line, i) => `Line ${start + i}: ${line}`)
                .join("\n");

            return numbered;
        } catch (err) {
            return `错误：无法读取文件 - ${filePath}，原因：${(err as Error).message}`;
        }
    }
}

export const searchCodeTool: Tool = {
    schema: {
        name: "search_code",
        description: "在当前项目中搜索包含特定关键词的文件。返回匹配的文件路径列表和第一条匹配行摘要。",
        parameters: {
            query: {
                type: "string",
                description: "搜索关键词，在文件内容中匹配"
            },
            filePattern: {
                type: "string",
                description: "文件名匹配模式，如 *.ts、*.md。不传则搜索所有文件"
            }
        },
        required: ["query"]
    },
    execute: async (args) => {
        // 校验必填参数
        if (!args.query || typeof args.query !== "string") {
            return "错误：缺少必填参数 query，或 query 类型不是 string";
        }
        // 拼 grep 命令，macOS BSD grep 不支持 --include="*"，此时省略
        const hasPattern = typeof args.filePattern === "string" && args.filePattern !== "*";
        const includeFlag = hasPattern ? `--include="${args.filePattern}"` : "";
        const command = `grep -rn ${includeFlag} --exclude-dir=node_modules --exclude-dir=.next "${args.query}" .`;

        // 执行
        try {
            const stdout = execSync(command, {
                cwd: process.cwd(),
                encoding: "utf-8",
                maxBuffer: 10 * 1024 * 1024,  // 10MB，防止超大输出
            });

            if (!stdout.trim()) {
                return `未找到包含 "${args.query}" 的文件`;
            }

            return stdout.trim();
        } catch (err: any) {
            // grep 找不到匹配时返回状态码 1，这是正常情况不是错误
            if (err.status === 1 && !err.stdout) {
                return `未找到包含 "${args.query}" 的文件`;
            }
            return `错误：搜索失败 - ${err.message}`;
        }
    }
};

function listDir(dir: string, depth: number, maxDepth: number = 3): string {
    // 达到最大深度，停止递归
    if (depth > maxDepth) return "";

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const lines: string[] = [];

    for (const entry of entries) {
        const indent = "  ".repeat(depth);           // 缩进表示层级
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            lines.push(`${indent}[目录] ${entry.name}/`);
            // 如果开启了递归（depth < maxDepth 说明还可以往下），继续深入
            if (depth < maxDepth) {
                const sub = listDir(fullPath, depth + 1, maxDepth);
                if (sub) lines.push(sub);
            }
        } else {
            lines.push(`${indent}[文件] ${entry.name}`);
        }
    }

    return lines.join("\n");
}

export const listDirectoryTool: Tool = {
    schema: {
        name: "list_directory",
        description: "列出指定目录下的文件和子目录。",
        parameters: {
            path: {
                type: "string",
                description: "目录路径，默认为项目根目录。支持相对路径或绝对路径"
            },
            recursive: {
                type: "boolean",
                description: "是否递归列出子目录，默认 false。注意递归深度最多 3 层"
            }
        },
        required: []
    },
    execute: async (args) => {
        // validatePath 内部已校验越界，不需要额外检查
        const dirPath = typeof args.path === "string"
            ? validatePath(args.path as string)
            : process.cwd();

        try {
            const recursive = args.recursive === true;
            const maxDepth = recursive ? 3 : 0;
            const output = listDir(dirPath, 0, maxDepth);
            return output || `目录为空：${dirPath}`;
        } catch (err) {
            return `错误：无法读取目录 - ${dirPath}，原因：${(err as Error).message}`;
        }
    }
};

export const writeFileTool: Tool = {
    schema: {
        name: "write_file",
        description: "创建新文件或覆盖已有文件的内容。仅在用户明确要求创建或修改文件时使用。返回写入结果。",
        parameters: {
            path: {
                type: "string",
                description: "要写入的文件路径，可以是相对路径或绝对路径"
            },
            content: {
                type: "string",
                description: "要写入文件的完整文本内容"
            }
        },
        required: ["path", "content"],
        risky: true
    },
    execute: async (args) => {
        if (!args.path || typeof args.path !== "string") {
            return "错误：缺少必填参数 path";
        }
        if (!args.content || typeof args.content !== "string") {
            return "错误：缺少必填参数 content";
        }

        const filePath = validatePath(args.path as string);

        try {
            fs.writeFileSync(filePath, args.content as string, "utf-8");
            return `文件已成功写入：${filePath}（${args.content.length} 字符）`;
        } catch (err) {
            return `错误：无法写入文件 - ${filePath}，原因：${(err as Error).message}`;
        }
    }
}

export const analyzeCodeTool: Tool = {
    schema: {
        name: "analyze_code",
        description: "对给定的代码片段做静态分析，检测潜在问题（安全漏洞、性能瓶颈、代码异味）。不负责搜索代码，只负责分析已经读取到的代码。返回问题列表。",
        parameters: {
            snippet: {
                type: "string",
                description: "要分析的代码片段字符串，通常来自 read_file 的返回结果"
            }
        },
        required: ["snippet"]
    },
    execute: async (args) => {
        if (!args.snippet || typeof args.snippet !== "string") {
            return "错误：缺少必填参数 snippet";
        }

        // 模拟分析：不真调 ESLint，而是返回占位结果，供实验用
        return `[analyze_code 模拟结果]
对以下代码片段的分析：
- 未检测到明显的安全漏洞
- 建议检查变量命名是否清晰
- 提示：如需深度分析，请接入 ESLint / TypeScript Compiler API

分析片段长度：${args.snippet.length} 字符`;
    }
}

/** 真实 LLM 版 analyze_code：接收 model，execute 里调 model.chat() 做代码分析 */
export function createAnalyzeCodeTool(model: ModelClient): Tool {
    return {
        schema: analyzeCodeTool.schema,
        execute: async (args) => {
            if (!args.snippet || typeof args.snippet !== "string") {
                return "错误：缺少必填参数 snippet";
            }
            const prompt = `请分析以下代码片段，检测潜在问题（安全漏洞、性能瓶颈、代码异味），返回具体问题列表：\n\n${args.snippet}`;
            return await model.chat([
                { role: "system", content: "你是一个代码审查专家，仔细分析代码并给出具体的改进建议。" },
                { role: "user", content: prompt },
            ]);
        }
    };
}

/** 创建默认工具注册表，注册全部 5 个工具 */
export function createDefaultRegistry(model?: ModelClient): ToolRegistry {
    const registry = new ToolRegistry();
    registry.register(readFileTool);
    registry.register(searchCodeTool);
    registry.register(listDirectoryTool);
    registry.register(writeFileTool);
    registry.register(model ? createAnalyzeCodeTool(model) : analyzeCodeTool);
    return registry;
}