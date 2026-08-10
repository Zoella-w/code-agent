"use client";
import { useState, useEffect, useRef } from "react";
import { AgentProvider } from "@/context/agent-context";
import { useAgent } from "@/hooks/useAgent";
import InputPanel from "@/components/InputPanel";
import TaskSidebar from "@/components/TaskSidebar";
import ResultPanel from "@/components/ResultPanel";
import TraceViewer from "@/components/TraceViewer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import EvalDashboard from "@/components/EvalDashboard";

export default function Home() {
  const { state, dispatch, sendOrchestrate, stopAgent, sendPRReview, createTask, switchTask, deleteTask, loadTasks } = useAgent();
  const [traceOpen, setTraceOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadTasks().then((count) => {
      if (count === 0) {
        createTask();
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.status === "done" && state.currentTaskId && state.mainAnswer) {
      fetch("/api/agent/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: state.currentTaskId,
          title: (state.tasks.find((t) => t.id === state.currentTaskId)?.title) || "代码审查",
          code: state.code,
          question: state.question,
          mode: state.mode,
          mainAnswer: state.mainAnswer,
          verifyAnswer: state.verifyAnswer,
          verifyResultPassed: state.verifyResult?.passed ?? null,
          toolSteps: state.toolSteps,
          status: "done",
          reviewMode: state.reviewMode,
          prUrl: state.prUrl,
          githubToken: state.githubToken,
        }),
      });
    }
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AgentProvider state={state} dispatch={dispatch}>
    <div className="h-full flex">
      <TaskSidebar
        onCreateTask={createTask}
        onSwitchTask={switchTask}
        onDeleteTask={deleteTask}
      />

      <div className="w-[40%] border-r shrink-0">
        <InputPanel
          onSend={state.reviewMode === "pr" ? sendPRReview : sendOrchestrate}
          onStop={stopAgent}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <ResultPanel
          onOpenTrace={() => setTraceOpen(true)}
          onOpenEval={() => setEvalOpen(true)}
          onRetry={state.reviewMode === "pr" ? sendPRReview : sendOrchestrate}
          onPostComment={async () => {
            const res = await fetch("/api/agent/pr-comment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prUrl: state.prUrl,
                reviewText: state.mainAnswer,
                githubToken: state.githubToken,
              }),
            });
            const data = await res.json();
            alert(data.success ? "✅ 评论已发布" : `❌ ${data.error}`);
          }}
        />
      </div>

      <TraceViewer
        open={traceOpen}
        onClose={() => setTraceOpen(false)}
      />

      <Sheet open={evalOpen} onOpenChange={(o) => setEvalOpen(o)}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>标注样本</SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">
            <EvalDashboard />
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </AgentProvider>
  );
}
