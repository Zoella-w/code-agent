// query 参数有三个信息：名字、类型、说明（如是否必填）
export interface ParamDef {
    type: "string" | "number" | "boolean",
    description: string
}

// Tool 的信息包含四个属性
export interface ToolSchema {
    name: string,
    description: string,
    parameters: Record<string, ParamDef>, // <key, value>
    required: string[],
    risky?: boolean  // 高风险工具需要审批，默认 false（参考 pico tool["risky"]）
}

// Tool 的信息 和 执行方法
export interface Tool {
    schema: ToolSchema,
    execute: (args: Record<string, unknown>) => Promise<string>
}

// 记录所有 tools
export class ToolRegistry {
    private tools: Map<string, Tool>;

    constructor() {
        this.tools = new Map();
    }

    register(tool: Tool): void {
        const key = tool.schema.name;
        this.tools.set(key, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAllNames(): string[] {
        return Array.from(this.tools.keys());
    }

    getAllSchemas(): string {
        let result = "";
        let index = 1;
        this.tools.forEach((tool: Tool) => {
            let curStr = ``;
            if (index !== 1) {
                curStr += `\n`;
            }
            curStr += `### ${index}. ${tool.schema.name}\n${tool.schema.description}\n`;
            if (Object.keys(tool.schema.parameters)?.length > 0) {
                curStr += `参数：`;
            }
            let isFirst = true;
            Object.entries(tool.schema.parameters).forEach(([key, value]) => {
                if (!isFirst) {
                    curStr += ` / `;
                }
                else {
                    isFirst = false;
                }
                curStr += `${key} (${value.type}, ${tool.schema.required.includes(key) ? "必填" : "可选"})`
            })
            result += curStr;
            index++;
        })
        return result;
    }
}