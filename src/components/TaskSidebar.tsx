"use client";
import { useAgentState } from "@/context/agent-context";

interface TaskSidebarProps {
    onCreateTask: () => void;
    onSwitchTask: (id: string) => void;
    onDeleteTask: (id: string) => void;
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
        <div className="h-full flex flex-col border-r" style={{ width: 240 }}>
            <div className="p-3 border-b">
                <button
                    onClick={onCreateTask}
                    disabled={disabled}
                    className="w-full text-sm px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                    + 新建任务
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                {tasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => !disabled && onSwitchTask(task.id)}
                        onContextMenu={(e) => {
                            if (disabled) return;
                            e.preventDefault();
                            if (confirm("删除这个任务？")) onDeleteTask(task.id);
                        }}
                        className={`px-3 py-2 text-sm border-b hover:bg-gray-50 ${
                            disabled ? "cursor-default opacity-50" : "cursor-pointer"
                        } ${
                            task.id === currentTaskId ? "bg-blue-50" : ""
                        }`}
                    >
                        <div className="font-medium truncate">{task.title}</div>
                        <div className="text-xs text-gray-500">
                            {task.status === "done" ? "✅" : "○"} {task.mode}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
