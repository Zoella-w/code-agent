"use client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// 定义这个组件需要父组件传什么数据给它
interface InputPanelProps {
    code: string;     // 父组件（page.tsx）传来的状态值，只读
    question: string; // 父组件（page.tsx）传来的状态值，只读
    status: string;   // 当前是 idle / running / done / error，用来禁用按钮
    onCodeChange: (value: string) => void;     // 用户输入时通知父组件更新 state
    onQuestionChange: (value: string) => void; // 用户输入时通知父组件更新 state
    onSend: () => void;                        // 点击发送按钮，调用父组件的 send 逻辑
}

export default function InputPanel({
    code,
    question,
    status,
    onCodeChange,
    onQuestionChange,
    onSend,
}: InputPanelProps) {
    // Agent 是否在跑，跑的时候禁止编辑代码
    const isRunning = status === "running";
    // 按钮是否可点
    // 代码非空、问题非空、不在运行中，任一不满足按钮就灰色不可点
    const canSend = question.trim() && !isRunning;

    return (
        <div className="h-full flex flex-col p-4 gap-4">
            {/* 代码输入区 */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
                <label className="text-sm font-medium text-muted-foreground">
                    代码
                </label>
                <Textarea
                    value={code}
                    onChange={(e) => onCodeChange(e.target.value)}
                    placeholder="在此粘贴需要审查的代码..."
                    className="flex-1 resize-none font-mono text-sm"
                    disabled={isRunning}
                />
            </div>

            {/* 问题输入区 */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                    审查要求
                </label>
                <Textarea
                    value={question}
                    onChange={(e) => onQuestionChange(e.target.value)}
                    placeholder="例如：分析这段代码的安全漏洞"
                    className="resize-none h-20"
                    disabled={isRunning}
                />
            </div>

            {/* 发送按钮 */}
            <Button onClick={onSend} disabled={!canSend} className="w-full">
                {isRunning ? "审查中..." : "发送审查"}
            </Button>
        </div>
    );
}