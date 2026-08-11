"use client";
import { useReducer, useRef } from "react";

export type AgentStatus = "idle" | "running" | "done" | "error";

interface ToolStep {
    step: number;
    toolName: string;
    args: Record<string, unknown>;
    observation?: string;
}

export interface VerifyResult {
    before: string;
    after: string;
    passed: boolean;
}

export interface Task {
    id: string;
    title: string;
    code: string;
    question: string;
    mode: "react" | "plan-execute" | "reflection";
    mainAnswer: string;
    verifyAnswer: string;
    verifyResult: VerifyResult | null;
    toolSteps: ToolStep[];
    status: AgentStatus;
    reviewMode: "code" | "pr";
    prUrl: string;
    githubToken: string;
}

export interface AgentState {
    code: string;
    question: string;
    mode: "react" | "plan-execute" | "reflection";
    verify: boolean;
    status: AgentStatus;
    phase: "executing" | "verifying" | null;
    mainAnswer: string;
    verifyAnswer: string;
    verifyResult: VerifyResult | null;
    error: string;
    traces: any[];
    contextStats: any;
    toolSteps: ToolStep[];
    tasks: Task[];
    currentTaskId: string | null;
    reviewMode: "code" | "pr";
    prUrl: string;
    githubToken: string;
    limited: boolean;
}

export type AgentAction =
    | { type: "SET_CODE"; payload: string }
    | { type: "SET_QUESTION"; payload: string }
    | { type: "SET_MODE"; payload: AgentState["mode"] }
    | { type: "SET_VERIFY"; payload: boolean }
    | { type: "SEND" }
    | { type: "SET_PHASE"; payload: AgentState["phase"] }
    | { type: "DELTA"; payload: string }
    | { type: "TOOL_START"; payload: { step: number; toolName: string; args: Record<string, unknown>; observation?: string } }
    | { type: "SET_VERIFY_RESULT"; payload: VerifyResult }
    | { type: "FINISH" }
    | { type: "STOP" }
    | { type: "SET_LIMITED"; payload: boolean }
    | { type: "FAIL"; payload: string }
    | { type: "RESET" }
    | { type: "NEW_TASK"; payload: string }
    | { type: "SWITCH_TASK"; payload: string }
    | { type: "DELETE_TASK"; payload: string }
    | { type: "SYNC_CURRENT_TASK" }
    | { type: "LOAD_TASKS"; payload: Task[] }
    | { type: "SET_REVIEW_MODE"; payload: "code" | "pr" }
    | { type: "SET_PR_URL"; payload: string }
    | { type: "SET_GITHUB_TOKEN"; payload: string };

function reducer(state: AgentState, action: AgentAction): AgentState {
    switch (action.type) {
        case "SET_CODE":
            return { ...state, code: action.payload };
        case "SET_QUESTION":
            return { ...state, question: action.payload };
        case "SET_MODE":
            return { ...state, mode: action.payload };
        case "SET_VERIFY":
            return { ...state, verify: action.payload };
        case "SEND":
            return { ...state, status: "running", mainAnswer: "", verifyAnswer: "", verifyResult: null, error: "", toolSteps: [], phase: null };
        case "FAIL":
            return { ...state, status: "error", error: action.payload };
        case "RESET":
            return { code: "", question: "", mode: "react", verify: false, status: "idle", phase: null, mainAnswer: "", verifyAnswer: "", verifyResult: null, error: "", traces: [], contextStats: null, toolSteps: [], tasks: [], currentTaskId: null, reviewMode: "code" as const, prUrl: "", githubToken: "", limited: false };
        case "SET_PHASE":
            return { ...state, phase: action.payload };
        case "DELTA":
            if (state.phase === "verifying") {
                return { ...state, verifyAnswer: state.verifyAnswer + action.payload };
            }
            return { ...state, mainAnswer: state.mainAnswer + action.payload };
        case "TOOL_START": {
            const existingIdx = state.toolSteps.findIndex((s) => s.step === action.payload.step);
            const entry = { step: action.payload.step, toolName: action.payload.toolName, args: action.payload.args, observation: action.payload.observation };
            if (existingIdx >= 0) {
                const updated = [...state.toolSteps];
                updated[existingIdx] = entry;
                return { ...state, toolSteps: updated };
            }
            return { ...state, toolSteps: [...state.toolSteps, entry] };
        }
        case "SET_VERIFY_RESULT":
            return { ...state, verifyResult: action.payload };
        case "FINISH":
            return { ...state, status: "done" };
        case "SYNC_CURRENT_TASK": {
            if (!state.currentTaskId) return state;
            return {
                ...state,
                tasks: state.tasks.map((t) =>
                    t.id === state.currentTaskId
                        ? { ...t, code: state.code, question: state.question, mode: state.mode, mainAnswer: state.mainAnswer, verifyAnswer: state.verifyAnswer, verifyResult: state.verifyResult, toolSteps: state.toolSteps, status: "done" as const, reviewMode: state.reviewMode, prUrl: state.prUrl, githubToken: state.githubToken }
                        : t
                ),
            };
        }
        case "STOP":
            return { ...state, status: "idle" };
        case "SET_LIMITED":
            return { ...state, limited: action.payload };
        case "NEW_TASK": {
            if (state.status === "running") return state;
            let updatedTasks = state.tasks;
            if (state.currentTaskId) {
                updatedTasks = state.tasks.map((t) =>
                    t.id === state.currentTaskId
                        ? { ...t, code: state.code, question: state.question, mode: state.mode, mainAnswer: state.mainAnswer, verifyAnswer: state.verifyAnswer, verifyResult: state.verifyResult, toolSteps: state.toolSteps, status: state.status, reviewMode: state.reviewMode, prUrl: state.prUrl, githubToken: state.githubToken }
                        : t
                );
            }
            const newTask: Task = {
                id: action.payload,
                title: `代码审查 #${updatedTasks.length + 1}`,
                code: "",
                question: "",
                mode: state.mode,
                mainAnswer: "",
                verifyAnswer: "",
                verifyResult: null,
                toolSteps: [],
                status: "idle",
                reviewMode: state.reviewMode,
                prUrl: "",
                githubToken: "",
            };
            return {
                ...state,
                code: "",
                question: "",
                mainAnswer: "",
                verifyAnswer: "",
                verifyResult: null,
                toolSteps: [],
                status: "idle",
                tasks: [...updatedTasks, newTask],
                currentTaskId: newTask.id,
            };
        }
        case "SWITCH_TASK": {
            if (state.status === "running") return state;
            const target = state.tasks.find((t) => t.id === action.payload);
            if (!target) return state;
            return {
                ...state,
                currentTaskId: target.id,
                code: target.code,
                question: target.question,
                mode: target.mode,
                mainAnswer: target.mainAnswer,
                verifyAnswer: target.verifyAnswer,
                verifyResult: target.verifyResult,
                toolSteps: target.toolSteps,
                status: target.status,
                reviewMode: target.reviewMode,
                prUrl: target.prUrl,
                githubToken: target.githubToken,
            };
        }
        case "DELETE_TASK": {
            if (state.status === "running") return state;
            const filtered = state.tasks.filter((t) => t.id !== action.payload);
            const nextId = state.currentTaskId === action.payload
                ? (filtered[0]?.id ?? null)
                : state.currentTaskId;
            return {
                ...state,
                tasks: filtered,
                currentTaskId: nextId,
            };
        }
        case "SET_REVIEW_MODE":
            return { ...state, reviewMode: action.payload };
        case "SET_PR_URL":
            return { ...state, prUrl: action.payload };
        case "SET_GITHUB_TOKEN":
            return { ...state, githubToken: action.payload };
        case "LOAD_TASKS": {
            const firstTask = action.payload[0];
            if (!firstTask) return { ...state, tasks: [], currentTaskId: null };
            return {
                ...state,
                tasks: action.payload,
                currentTaskId: firstTask.id,
                code: firstTask.code,
                question: firstTask.question,
                mode: firstTask.mode,
                mainAnswer: firstTask.mainAnswer,
                verifyAnswer: firstTask.verifyAnswer,
                verifyResult: firstTask.verifyResult,
                toolSteps: firstTask.toolSteps,
                status: firstTask.status,
                reviewMode: firstTask.reviewMode,
                prUrl: firstTask.prUrl,
                githubToken: firstTask.githubToken,
            };
        }
        default:
            return state;
    }
}

const initialState: AgentState = {
    code: "", question: "", mode: "react", verify: false, status: "idle", phase: null, mainAnswer: "", verifyAnswer: "", verifyResult: null, error: "", traces: [], contextStats: null, toolSteps: [], tasks: [], currentTaskId: null, reviewMode: "code", prUrl: "", githubToken: "", limited: false,
};

export function useAgent() {
    const [state, dispatch] = useReducer(reducer, initialState);
    const controllerRef = useRef<AbortController | null>(null);

    const DEFAULT_QUESTION = "请分析这段代码的安全漏洞和潜在问题";

    // ---- 防滥用限流（前端层）：localStorage 计数即时拦截 + 作者豁免 header ----
    const USAGE_LIMIT = 3;
    const USAGE_STORAGE_KEY = "code-agent-requests";
    const OWNER_STORAGE_KEY = "demo-owner";
    const USAGE_ERROR_CODE = "USAGE_LIMIT_REACHED";

    const getLocalUsageCount = (): number => {
        if (typeof window === "undefined") return 0;
        return Number(localStorage.getItem(USAGE_STORAGE_KEY) ?? 0);
    };
    const incrementLocalUsage = (): void => {
        try {
            localStorage.setItem(USAGE_STORAGE_KEY, String(getLocalUsageCount() + 1));
        } catch {
            /* 隐私模式下 localStorage 不可写，忽略 */
        }
    };
    const getOwnerSecret = (): string | null =>
        typeof window === "undefined" ? null : localStorage.getItem(OWNER_STORAGE_KEY);
    const buildHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const owner = getOwnerSecret();
        if (owner) headers["x-demo-owner"] = owner;
        return headers;
    };
    /** 发起请求前判断：作者豁免或本地额度未满 → true；否则置 limited 并拦截 */
    const canIssueRequest = (): boolean => {
        if (getOwnerSecret()) return true;
        if (state.limited || getLocalUsageCount() >= USAGE_LIMIT) {
            dispatch({ type: "SET_LIMITED", payload: true });
            return false;
        }
        return true;
    };

    const sendStream = async () => {
        if (!state.code.trim()) return;
        if (!state.question.trim()) {
            dispatch({ type: "SET_QUESTION", payload: DEFAULT_QUESTION });
        }
        const promptQuestion = state.question.trim() || DEFAULT_QUESTION;
        dispatch({ type: "SEND" });

        try {
            const res = await fetch("/api/agent/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: `${promptQuestion}\n\n代码：\n${state.code}` }),
            });
            if (!res.ok || !res.body) throw new Error("流式请求失败");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    if (!part.trim()) continue;
                    const jsonStr = part.replace(/^data:\s*/, "");
                    const event = JSON.parse(jsonStr);
                    switch (event.type) {
                        case "delta":
                            dispatch({ type: "DELTA", payload: event.text });
                            break;
                        case "step":
                            dispatch({ type: "TOOL_START", payload: event });
                            break;
                    }
                }
            }
            dispatch({ type: "FINISH" });
        } catch (err: any) {
            dispatch({ type: "FAIL", payload: err.message });
        }
    };

    const sendOrchestrate = async () => {
        if (!state.code.trim() && !state.question.trim()) return;
        if (!canIssueRequest()) return;
        if (!state.question.trim()) {
            dispatch({ type: "SET_QUESTION", payload: DEFAULT_QUESTION });
        }
        const promptQuestion = state.question.trim() || DEFAULT_QUESTION;

        // 确保有任务：初始化异步未完成时用户可能抢先发送
        if (!state.currentTaskId) {
            const res = await fetch("/api/agent/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: `代码审查 #1`, mode: state.mode }),
            });
            const data = await res.json();
            dispatch({ type: "NEW_TASK", payload: data.task.id });
        }

        dispatch({ type: "SEND" });
        if (!getOwnerSecret()) incrementLocalUsage();

        const controller = new AbortController();
        controllerRef.current = controller;

        try {
            const res = await fetch("/api/agent/orchestrate", {
                method: "POST",
                headers: buildHeaders(),
                body: JSON.stringify({
                    prompt: `${promptQuestion}\n\n代码：\n${state.code}`,
                    mode: state.mode,
                    verify: state.verify,
                }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({ error: "编排请求失败" }));
                if (data.error === USAGE_ERROR_CODE) dispatch({ type: "SET_LIMITED", payload: true });
                dispatch({ type: "FAIL", payload: data.message ?? data.error ?? "编排请求失败" });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    if (!part.trim()) continue;
                    const jsonStr = part.replace(/^data:\s*/, "");
                    const event = JSON.parse(jsonStr);
                    switch (event.type) {
                        case "phase":
                            dispatch({ type: "SET_PHASE", payload: event.phase });
                            break;
                        case "delta":
                            dispatch({ type: "DELTA", payload: event.text });
                            break;
                        case "step":
                            dispatch({ type: "TOOL_START", payload: event });
                            break;
                        case "done":
                            if (event.verifyResult) {
                                dispatch({ type: "SET_VERIFY_RESULT", payload: event.verifyResult });
                            }
                            dispatch({ type: "FINISH" });
                            dispatch({ type: "SYNC_CURRENT_TASK" });
                            break;
                    }
                }
            }
        } catch (err: any) {
            if (err.name === "AbortError") return;
            dispatch({ type: "FAIL", payload: err.message });
        } finally {
            controllerRef.current = null;
        }
    };

    const stopAgent = () => {
        controllerRef.current?.abort();
        dispatch({ type: "STOP" });
        controllerRef.current = null;
    };

    const createTask = async () => {
        const res = await fetch("/api/agent/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: `代码审查 #${state.tasks.length + 1}`,
                mode: "react",
            }),
        });
        const data = await res.json();
        dispatch({ type: "NEW_TASK", payload: data.task.id });
    };
    const switchTask = (id: string) => dispatch({ type: "SWITCH_TASK", payload: id });
    const deleteTask = async (id: string) => {
        const prevTasks = state.tasks;
        dispatch({ type: "DELETE_TASK", payload: id });
        try {
            await fetch(`/api/agent/tasks?id=${id}`, { method: "DELETE" });
        } catch {
            dispatch({ type: "LOAD_TASKS", payload: prevTasks });
        }
    };

    const loadTasks = async (): Promise<number> => {
        const res = await fetch("/api/agent/tasks");
        const data = await res.json();
        if (data.tasks) {
            dispatch({ type: "LOAD_TASKS", payload: data.tasks });
            return data.tasks.length;
        }
        return 0;
    };

    const sendPRReview = async () => {
        if (!state.prUrl.trim()) return;
        if (!canIssueRequest()) return;

        if (!state.currentTaskId) {
            const res = await fetch("/api/agent/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: `代码审查 #1`, mode: state.mode }),
            });
            const data = await res.json();
            dispatch({ type: "NEW_TASK", payload: data.task.id });
        }

        dispatch({ type: "SEND" });
        if (!getOwnerSecret()) incrementLocalUsage();

        const controller = new AbortController();
        controllerRef.current = controller;

        try {
            const res = await fetch("/api/agent/pr-review", {
                method: "POST",
                headers: buildHeaders(),
                body: JSON.stringify({
                    prUrl: state.prUrl,
                    githubToken: state.githubToken || undefined,
                    verify: state.verify,
                }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => ({ error: "请求失败" }));
                if (data.error === USAGE_ERROR_CODE) dispatch({ type: "SET_LIMITED", payload: true });
                dispatch({ type: "FAIL", payload: data.message ?? data.error ?? "请求失败" });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop() ?? "";

                for (const part of parts) {
                    if (!part.trim()) continue;
                    const jsonStr = part.replace(/^data:\s*/, "");
                    const event = JSON.parse(jsonStr);
                    switch (event.type) {
                        case "phase":
                            dispatch({ type: "SET_PHASE", payload: event.phase });
                            break;
                        case "delta":
                            dispatch({ type: "DELTA", payload: event.text });
                            break;
                        case "step":
                            dispatch({ type: "TOOL_START", payload: event });
                            break;
                        case "done":
                            if (event.verifyResult) {
                                dispatch({ type: "SET_VERIFY_RESULT", payload: event.verifyResult });
                            }
                            dispatch({ type: "FINISH" });
                            dispatch({ type: "SYNC_CURRENT_TASK" });
                            break;
                    }
                }
            }
        } catch (err: any) {
            if (err.name === "AbortError") return;
            dispatch({ type: "FAIL", payload: err.message });
        } finally {
            controllerRef.current = null;
        }
    };

    return { state, dispatch, sendStream, sendOrchestrate, stopAgent, sendPRReview, createTask, switchTask, deleteTask, loadTasks };
}
