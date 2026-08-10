"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dispatch, ReactNode } from "react";
import type { AgentState, AgentAction } from "@/hooks/useAgent";

// ① 两个标签：一个放 state（多变），一个放 dispatch（稳定）
export const AgentStateContext = createContext<AgentState | null>(null);
export const AgentDispatchContext = createContext<Dispatch<AgentAction> | null>(null);

// ② Provider：把 state + dispatch 喂给子树
export function AgentProvider({
  state,
  dispatch,
  children,
}: {
  state: AgentState;
  dispatch: Dispatch<AgentAction>;
  children: ReactNode;
}) {
  // dispatch 从 useReducer 出来就稳定，useMemo 只算一次 → 锁死引用 → 该 Context 消费者零重渲染
  const stableDispatch = useMemo(() => dispatch, [dispatch]);

  return (
    <AgentStateContext.Provider value={state}>
      <AgentDispatchContext.Provider value={stableDispatch}>
        {children}
      </AgentDispatchContext.Provider>
    </AgentStateContext.Provider>
  );
}

// ③ 两个读取 hook：null 检查，用错位置立刻报错，而不是悄悄拿 undefined
export function useAgentState() {
  const ctx = useContext(AgentStateContext);
  if (ctx === null) throw new Error("useAgentState 必须在 <AgentProvider> 内部使用");
  return ctx;
}

export function useAgentDispatch() {
  const ctx = useContext(AgentDispatchContext);
  if (ctx === null) throw new Error("useAgentDispatch 必须在 <AgentProvider> 内部使用");
  return ctx;
}
