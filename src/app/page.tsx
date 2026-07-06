"use client";
import { useState } from "react";
import { useAgent } from "@/hooks/useAgent";
import InputPanel from "@/components/InputPanel";
import ChatPanel from "@/components/ChatPanel";
import TraceViewer from "@/components/TraceViewer";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
}

export default function Home() {
  const { state, dispatch, sendStream } = useAgent();
  const [traceOpen, setTraceOpen] = useState(false);

  const messages: ChatMessage[] = [];
  if (state.status !== "idle" && state.question) {
    messages.push({ role: "user", content: state.question });
  }

  return (
    <div className="h-full flex">
      <div className="w-[40%] border-r shrink-0">
        <InputPanel
          code={state.code}
          question={state.question}
          status={state.status}
          onCodeChange={(v) => dispatch({ type: "SET_CODE", payload: v })}
          onQuestionChange={(v) => dispatch({ type: "SET_QUESTION", payload: v })}
          onSend={sendStream}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel
          messages={messages}
          status={state.status}
          answer={state.answer}
          toolSteps={state.toolSteps}
          onOpenTrace={() => setTraceOpen(true)}
        />
      </div>

      <TraceViewer
        open={traceOpen}
        onClose={() => setTraceOpen(false)}
        traces={state.traces}
        toolSteps={state.toolSteps}
        contextStats={state.contextStats}
      />
    </div>
  );
}
