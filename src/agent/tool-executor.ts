import { ToolRegistry } from "./tools";
import { FileSummaryStore } from "./memory";
import * as fs from "node:fs";
import path from "node:path"

/** 默认已知的敏感环境变量名（参考 pico DEFAULT_SECRET_ENV_NAMES） */
const DEFAULT_SECRET_ENV_NAMES = new Set([
    "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN",
    "OPENAI_API_KEY", "OPENAI_API_TOKEN",
    "DEEPSEEK_API_KEY",
    "SILICONFLOW_API_KEY",
    "GITHUB_PAT", "GH_PAT",
    "SUPABASE_KEY", "SUPABASE_SERVICE_KEY",
    "DATABASE_URL",
]);

/** 如果环境变量名以这些后缀结尾，则认为它包含敏感值 */
const SENSITIVE_ENV_NAME_MARKERS = ["API_KEY", "TOKEN", "SECRET", "PASSWORD"];

/** 判断环境变量名是否包含敏感标记（name.endsWith(marker) 或 name.endsWith(_marker)） */
function looksSensitiveEnvName(name: string): boolean {
    const upper = name.toUpperCase();
    return SENSITIVE_ENV_NAME_MARKERS.some(
        (marker) => upper === marker || upper.endsWith(marker) || upper.endsWith(`_${marker}`)
    );
}

/** 将文本中出现的所有已知敏感值替换为 <redacted>（按 value 长度降序替换，避免短值覆盖长值的前缀） */
export function redactText(text: string, secrets: [string, string][]): string {
    let result = String(text);
    for (const [, value] of secrets) {
        if (value.length > 2) result = result.split(value).join("<redacted>");
    }
    return result;
}

/** 递归遍历任意值，对敏感 key 的整体值 + 所有字符串值中的敏感内容进行脱敏 */
export function redactArtifact(
    value: unknown,
    secrets: [string, string][],
    isSecretName: (name: string) => boolean,
    key?: string
): unknown {
    // 如果当前 key 本身是敏感名，整个值直接丢弃
    if (key && isSecretName(key)) return "<redacted>";
    if (typeof value === "string") return redactText(value, secrets);
    if (Array.isArray(value)) return value.map((item) => redactArtifact(item, secrets, isSecretName, key));
    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            result[k] = redactArtifact(v, secrets, isSecretName, k);
        }
        return result;
    }
    return value;
}

/** 判断环境变量名是否在默认敏感列表或匹配后缀规则 */
export function isSecretEnvName(name: string): boolean {
    const upper = name.toUpperCase();
    return DEFAULT_SECRET_ENV_NAMES.has(upper) || looksSensitiveEnvName(name);
}

/** 扫描 process.env，返回所有被识别为敏感的环境变量 (name, value) 对，按 value 长度降序排列 */
export function detectSecretEnvItems(): [string, string][] {
    const items: [string, string][] = [];
    for (const [name, value] of Object.entries(process.env)) {
        const upper = name.toUpperCase();
        if (DEFAULT_SECRET_ENV_NAMES.has(upper) || looksSensitiveEnvName(name)) {
            if (value) items.push([name, value]);
        }
    }
    items.sort((a, b) => b[1].length - a[1].length);
    return items;
}

// 统一工具执行结果，替代裸 string
export interface ToolResult {
    success: boolean;
    content: string;
    truncated: boolean;
    durationMs: number;
}

export interface TraceEntry {
    toolName: string;
    args: Record<string, unknown>;
    success: boolean;
    durationMs: number;
    timestamp: number;       // Date.now()
    contentPreview: string;  // 前 200 字符
}

/** 审批模式（参考 pico --approval ask/auto/never） */
export type ApprovalMode = "ask" | "auto" | "never";

/** 审批挂起：runId → resolve/reject */
interface PendingApproval {
    resolve: (approved: boolean) => void;
    reject: (err: Error) => void;
}

/** 审批所需信息 */
export interface ApprovalRequest {
    runId: string;
    toolName: string;
    args: Record<string, unknown>;
}

// 执行上下文配置
export class ToolExecutor {
    private registry: ToolRegistry;
    readonly sandboxRoot: string;
    private traces: TraceEntry[] = [];
    private fileStore?: FileSummaryStore;
    /** 记录上一次工具调用的名称+参数，用于检测连续重复调用 */
    private lastCall: { name: string; args: Record<string, unknown> } | null = null;
    /** 审批模式 */
    approvalPolicy: ApprovalMode = "ask";
    /** 审批挂起回调，由 stream route 注入 */
    onApprovalRequired: ((req: ApprovalRequest) => void) | null = null;
    /** 挂起的审批 Map（runId → PendingApproval） */
    private pendingApprovals = new Map<string, PendingApproval>();
    /** 环境变量敏感值缓存，构造时扫描一次 */
    private secrets: [string, string][] = [];

    constructor(registry: ToolRegistry, sandboxRoot?: string, fileStore?: FileSummaryStore) {
        this.registry = registry;
        this.sandboxRoot = sandboxRoot ?? process.cwd();
        this.traces = [];
        this.fileStore = fileStore;
        this.secrets = detectSecretEnvItems();
    }

    // 执行一个工具，返回统一格式的 ToolResult
    async execute(
        name: string,
        args: Record<string, unknown>,
        timeoutMs: number = 30000,
        runId?: string
    ): Promise<ToolResult> {
        const tool = this.registry.get(name);
        if (!tool) {
            return {
                success: false,
                content: `工具 ${name} 不存在`,
                truncated: false,
                durationMs: 0,
            };
        }

        // 工具参数校验（参考 pico execute_tool 流程：先 validate 再重复调用检测）
        try {
            this.validateTool(name, args);
        } catch (err) {
            return {
                success: false,
                content: `参数校验失败：${(err as Error).message}`,
                truncated: false,
                durationMs: 0,
            };
        }

        // 重复调用检测：连续两次相同工具+相同参数则拒绝，防止 Agent 死循环
        if (
            this.lastCall &&
            this.lastCall.name === name &&
            JSON.stringify(this.lastCall.args) === JSON.stringify(args)
        ) {
            return {
                success: false,
                content: `重复调用拦截：工具 ${name} 已用相同参数连续调用两次，请尝试其他操作`,
                truncated: false,
                durationMs: 0,
            };
        }

        this.lastCall = { name, args };

        // 审批检查（参考 pico run_tool 流程：validate → repeated → approve → execute）
        if (tool.schema.risky && runId) {
            const approved = await this.approve(runId, name, args);
            if (!approved) {
                return {
                    success: false,
                    content: `审批拒绝：工具 ${name} 的执行被用户拒绝`,
                    truncated: false,
                    durationMs: 0,
                };
            }
        }

        const startTime = Date.now();
        try {
            const rawResult = await Promise.race([
                tool.execute(args),
                new Promise<string>((_, reject) =>
                    setTimeout(
                        () => reject(new Error(`工具执行超时（${timeoutMs}ms）`)),
                        timeoutMs,
                    )
                ),
            ]);
            const cleanResult = redactText(rawResult, this.secrets);
            const durationMs = Date.now() - startTime;
            const maxLen = 3000;
            const truncated = cleanResult.length > maxLen;
            const content = truncated
                ? cleanResult.slice(0, maxLen) + "\n...(输出过长，已截断)"
                : cleanResult;
            this.traces.push({
                toolName: name,
                args,
                success: true,
                durationMs,
                timestamp: startTime,
                contentPreview: content.slice(0, 200),
            });

            // 如果 name === "read_file" 且 this.fileStore 存在：
            //   1. 从 args.path 拿到文件路径
            //   2. 用 fs 读一次文件内容（用来算 hash）
            //   3. 调用 this.fileStore.set(filePath, 文件内容, 工具返回的content)
            if (name === "read_file") {
                const filePath = args.path as string;
                const fileContent = fs.readFileSync(filePath, "utf-8");
                this.fileStore?.set(filePath, fileContent, content);
            }

            return {
                success: true,
                content,
                truncated,
                durationMs,
            };
        } catch (err) {
            const isTimeout = (err as Error).message.includes("超时");
            const errorDurationMs = isTimeout ? timeoutMs : Date.now() - startTime;

            this.traces.push({
                toolName: name,
                args,
                success: false,
                durationMs: errorDurationMs,
                timestamp: startTime,
                contentPreview: (err as Error).message.slice(0, 200),
            });

            return {
                success: false,
                content: isTimeout
                    ? `调用工具 ${name} 超时（${timeoutMs}ms），请减少查询范围后重试`
                    : `调用工具 ${name} 失败：${(err as Error).message}`,
                truncated: isTimeout,
                durationMs: errorDurationMs,
            };
        }
    }

    // 工具校验（参考 pico validate_tool），将通用校验和 runtime 级约束串起来
    validateTool(name: string, args: Record<string, unknown>): void {
        validateToolArgs(name, args, this.sandboxRoot);
    }

    /** 判断是否批准执行（参考 pico approve()）：auto→批准, never→拒绝, ask→挂起等用户 */
    async approve(runId: string, name: string, args: Record<string, unknown>): Promise<boolean> {
        if (this.approvalPolicy === "auto") return true;
        if (this.approvalPolicy === "never") return false;
        // ask 模式：通知前端并挂起等待
        return new Promise((resolve, reject) => {
            this.pendingApprovals.set(runId, { resolve, reject });
            if (this.onApprovalRequired) {
                this.onApprovalRequired({ runId, toolName: name, args });
            }
        });
    }

    /** 外部调用，传入用户审批决定，唤醒挂起的 execute() */
    resolveApproval(runId: string, approved: boolean): void {
        const pending = this.pendingApprovals.get(runId);
        if (pending) {
            this.pendingApprovals.delete(runId);
            pending.resolve(approved);
        }
    }

    // 把用户/LLM 传入的路径解析成绝对路径，并校验不越界。越界抛错，合法返回 resolved path.
    validatePath(rawPath: string): string {
        return validatePath(rawPath, this.sandboxRoot);
    }

    /** 返回所有工具调用的追踪记录 */
    getTraces(): TraceEntry[] {
        return this.traces;
    }
}

/** 按工具名分别校验参数（参考 pico tools.py validate_tool if/elif 链），校验失败抛 Error */
export function validateToolArgs(name: string, args: Record<string, unknown>, sandboxRoot?: string): void {
    const root = sandboxRoot ?? process.cwd();

    if (name === "read_file") {
        const filePath = validatePath(args.path as string, root);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) throw new Error("path is not a file");
        const start = typeof args.startLine === "number" ? args.startLine : 1;
        const end = typeof args.endLine === "number" ? args.endLine : 200;
        if (start < 1 || end < start) throw new Error("invalid line range");
        return;
    }

    if (name === "search_code") {
        const query = String(args.query ?? "").trim();
        if (!query) throw new Error("query must not be empty");
        if (args.filePattern !== undefined && args.filePattern !== null) {
            if (typeof args.filePattern !== "string") throw new Error("filePattern must be a string");
        }
        return;
    }

    if (name === "list_directory") {
        const dirPath = typeof args.path === "string" ? validatePath(args.path, root) : root;
        if (!fs.statSync(dirPath).isDirectory()) throw new Error("path is not a directory");
        return;
    }

    if (name === "write_file") {
        const filePath = validatePath(args.path as string, root);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
            throw new Error("path is a directory");
        }
        if (typeof args.content !== "string" || !args.content) {
            throw new Error("missing content");
        }
        return;
    }

    if (name === "analyze_code") {
        const snippet = String(args.snippet ?? "").trim();
        if (!snippet) throw new Error("snippet must not be empty");
        return;
    }
}

/** 路径沙箱校验工具函数，不依赖 ToolExecutor 实例，工具可直接调用 */
export function validatePath(rawPath: string, sandboxRoot?: string): string {
    const root = sandboxRoot ?? process.cwd();
    const resolved = path.resolve(rawPath);
    if (!resolved.startsWith(root)) {
        throw new Error(`路径越界：${resolved} 不在沙箱 ${root} 内`);
    }
    return resolved;
}