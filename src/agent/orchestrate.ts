import { createDefaultRegistry } from "./tool-defs";
import { ToolExecutor } from "./tool-executor";
import { AnthropicModelClient, type ModelConfig } from "./model-client";
import runReActLoop from "./react-runtime";
import planAndExecute from "./plan-execute-runtime";
import reflectAndExecute from "./reflection-runtime";
import type { ModelClient } from "./react-runtime";
import type { ToolRegistry } from "./tools";

// ── 类型 ─────────────────────────────────────────────────

export type AgentMode = "react" | "plan-execute" | "reflection";

export interface OrchestrateRequest {
    prompt: string;
    mode: AgentMode;
    verify?: boolean;
}

export type OrchestrateSSEEvent =
    | { type: "delta"; text: string }
    | { type: "step"; step: number; toolName: string; args: Record<string, unknown>; observation?: string }
    | { type: "approval_required"; runId: string; toolName: string; args: Record<string, unknown> }
    | { type: "phase"; phase: "executing" | "verifying" | "done" }
    | { type: "done"; mode: string; verifyResult?: { before: string; after: string; passed: boolean } };

// ── SSE 工具 ─────────────────────────────────────────────

export function sendSSE(
    controller: ReadableStreamDefaultController,
    event: OrchestrateSSEEvent,
): void {
    controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
    );
}

// ── 调度 ─────────────────────────────────────────────────

/** 根据 mode 将请求分发到对应的 Agent Runtime */
export async function dispatch(
    mode: AgentMode,
    prompt: string,
    registry: ToolRegistry,
    executor: ToolExecutor,
    model: ModelClient,
    signal?: AbortSignal,
): Promise<string> {
    switch (mode) {
        case "react":
            return await runReActLoop(prompt, registry, executor, model, undefined, signal);
        case "plan-execute":
            return await planAndExecute(prompt, registry, executor, model, signal);
        case "reflection": {
            const result = await reflectAndExecute(prompt, registry, executor, model, signal);
            return result.answer;
        }
        default:
            throw new Error(`不支持的运行模式：${mode}`);
    }
}

// ── 编排流 ───────────────────────────────────────────────

/** 创建编排 SSE 流：统一入口 → dispatch Runtime → 可选验证 → 返回结果 */
export function createOrchestrateStream(
    request: OrchestrateRequest,
    config?: ModelConfig,
    signal?: AbortSignal,
): ReadableStream {
    const { prompt, mode, verify } = request;

    return new ReadableStream({
        async start(controller) {
            if (signal?.aborted) {
                controller.close();
                return;
            }
            signal?.addEventListener("abort", () => {
                controller.close();
            }, { once: true });

            try {
                const model = new AnthropicModelClient(config);
                const registry = createDefaultRegistry(model);
                const executor = new ToolExecutor(registry);

                // 执行阶段
                sendSSE(controller, { type: "phase", phase: "executing" });
                const mainAnswer = await dispatch(mode, prompt, registry, executor, model, signal);
                sendSSE(controller, { type: "delta", text: mainAnswer });

                // 验证阶段（可选）
                let verifyResult: { before: string; after: string; passed: boolean } | undefined;
                if (verify) {
                    sendSSE(controller, { type: "phase", phase: "verifying" });
                    // 结构化 prompt 防注入：用明确指令包裹用户输入，截断过长内容
                    const verifyTask = [
                        "## 任务",
                        "验证以下代码审查结果是否准确、完整。",
                        "## 原始审查目标",
                        prompt.slice(0, 2000),
                        "## 审查结果",
                        mainAnswer,
                        "## 验证要求",
                        "1. 逐条检查审查结果中的每个发现，判断是否为真实问题",
                        "2. 指出遗漏的问题（如果存在）",
                        "3. 指出误报（如果存在）",
                        "4. 输出格式（严格执行）：",
                        "   第一行必须且只能输出 VERDICT: PASS 或 VERDICT: FAIL",
                        "   PASS = 审查报告中的发现均为真实问题，无严重误报或遗漏",
                        "   FAIL = 审查报告存在严重误报或重大遗漏",
                        "   空一行后再写逐条理由",
                    ].join("\n");
                    const verifyMessages = [
                        { role: "system" as const, content: "你是严格的代码审查验证器。只输出分析结果，不调用任何工具。" },
                        { role: "user" as const, content: verifyTask },
                    ];
                    const verifyAnswer = await model.chat(verifyMessages);
                    sendSSE(controller, { type: "delta", text: verifyAnswer });

                    // 解析机器可读的判决行，精确匹配避免正文干扰
                    const verdictMatch = verifyAnswer.match(/^VERDICT:\s*(PASS|FAIL)/im);
                    const hasIssue = !verdictMatch || verdictMatch[1] === "FAIL";
                    verifyResult = {
                        before: mainAnswer,
                        after: verifyAnswer,
                        passed: !hasIssue,
                    };

                    // 有问题
                    if (!verifyResult.passed) {
                        sendSSE(controller, { type: "delta", text: "验证未通过，请查看验证报告" });
                    }
                }

                // 结束
                sendSSE(controller, { type: "done", mode, verifyResult });
            } catch (err) {
                if (signal?.aborted) return;
                // 不暴露原始错误详情给前端，防止泄露内部路径/密钥等敏感信息
                const message = (err as Error).message.startsWith("不支持的运行模式")
                    ? (err as Error).message
                    : "服务异常，请重试";
                sendSSE(controller, { type: "delta", text: message });
                sendSSE(controller, { type: "done", mode });
            } finally {
                controller.close();
            }
        },
    });
}
