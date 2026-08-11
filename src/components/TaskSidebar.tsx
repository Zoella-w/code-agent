"use client";
import { useAgentState } from "@/context/agent-context";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Circle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskSidebarProps {
    onCreateTask: () => void;
    onSwitchTask: (id: string) => void;
    onDeleteTask: (id: string) => void;
}

/** 模式缩写，用于任务行右侧的小标签 */
function modeTag(task: { mode: "react" | "plan-execute" | "reflection"; reviewMode: "code" | "pr" }): string {
    if (task.reviewMode === "pr") return "PR";
    if (task.mode === "react") return "ReAct";
    if (task.mode === "plan-execute") return "P&E";
    return "Refl";
}

export default function TaskSidebar({
    onCreateTask,
    onSwitchTask,
    onDeleteTask,
}: TaskSidebarProps) {
    // 数据走 Context；disabled 是派生状态，组件内部推导
    const { tasks, currentTaskId, status } = useAgentState();
    const disabled = status === "running";
    return (
        <div className="h-full flex flex-col border-r bg-muted/20 w-60 shrink-0">
            <div className="p-3 border-b">
                <Button onClick={onCreateTask} disabled={disabled} className="w-full gap-1.5" size="sm">
                    <Plus className="size-4" />
                    新建任务
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">
                {tasks.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-10 px-4">
                        暂无任务
                    </div>
                ) : (
                    tasks.map((task) => {
                        const active = task.id === currentTaskId;
                        return (
                            <div
                                key={task.id}
                                onClick={() => !disabled && onSwitchTask(task.id)}
                                onContextMenu={(e) => {
                                    if (disabled) return;
                                    e.preventDefault();
                                    if (confirm("删除这个任务？")) onDeleteTask(task.id);
                                }}
                                className={cn(
                                    "group relative mx-1.5 mb-0.5 px-3 py-2 rounded-md cursor-pointer transition-colors",
                                    disabled ? "opacity-50 cursor-default" : "hover:bg-muted",
                                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    {task.status === "done" ? (
                                        <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                                    ) : (
                                        <Circle className="size-3.5 text-muted-foreground/60 shrink-0" />
                                    )}
                                    <span className={cn("font-medium truncate flex-1", active && "text-foreground")}>
                                        {task.title}
                                    </span>
                                    <span className="rounded border border-border px-1 py-0.5 text-[10px] leading-none shrink-0">
                                        {modeTag(task)}
                                    </span>
                                    {!disabled && (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm("删除这个任务？")) onDeleteTask(task.id);
                                            }}
                                            className="hidden group-hover:flex items-center text-muted-foreground hover:text-destructive shrink-0"
                                            title="删除任务"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
