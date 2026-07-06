"use client";
import { useReducer } from "react";

export type AgentStatus = "idle" | "running" | "done" | "error";

interface ToolStep {
    step: number;
    toolName: string;
    args: Record<string, unknown>;
    observation?: string;
}

export interface AgentState {
    code: string;
    question: string;
    status: AgentStatus;
    answer: string;
    error: string;
    traces: any[];
    contextStats: any;
    toolSteps: ToolStep[];
}

type AgentAction =
    | { type: "SET_CODE"; payload: string }
    | { type: "SET_QUESTION"; payload: string }
    | { type: "SEND" }
    | { type: "FAIL"; payload: string }
    | { type: "RESET" }
    | { type: "DELTA"; payload: string }
    | { type: "TOOL_START"; payload: { step: number; toolName: string; args: Record<string, unknown>; observation?: string } }
    | { type: "FINISH" };

function reducer(state: AgentState, action: AgentAction): AgentState {
    switch (action.type) {
        case "SET_CODE":
            return { ...state, code: action.payload };
        case "SET_QUESTION":
            return { ...state, question: action.payload };
        case "SEND":
            return { ...state, status: "running", answer: "", error: "", toolSteps: [] };
        case "FAIL":
            return { ...state, status: "error", error: action.payload };
        case "RESET":
            return { code: "", question: "", status: "idle", answer: "", error: "", traces: [], contextStats: null, toolSteps: [] };
        case "DELTA":
            return { ...state, answer: state.answer + action.payload };
        case "TOOL_START":
            return {
                ...state,
                toolSteps: [...state.toolSteps, { step: action.payload.step, toolName: action.payload.toolName, args: action.payload.args, observation: action.payload.observation }],
            };
        case "FINISH":
            return { ...state, status: "done" };
        default:
            return state;
    }
}

const initialState: AgentState = {
    code: "", question: "", status: "idle", answer: "", error: "", traces: [], contextStats: null, toolSteps: [],
};

export function useAgent() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const sendStream = async () => {
        if (!state.question.trim()) return;
        dispatch({ type: "SEND" });

        try {
            const res = await fetch("/api/agent/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: `${state.question}\n\n代码：\n${state.code}` }),
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

    return { state, dispatch, sendStream };
}
