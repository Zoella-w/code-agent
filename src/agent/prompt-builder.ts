import { ToolRegistry } from "./tools";

export const DEFAULT_SYSTEM_PROMPT = `你是一个专业的代码审查助手。你的任务是帮助用户理解和审查代码。

  你可以通过以下工具来读取文件、搜索代码、浏览项目结构。在回答用户问题之前，优先使用工具获取真实的代码内容，而不是凭记忆猜
  测。`;

/**
 * 组装完整的 System Prompt
 * @param registry - 工具注册中心
 */
export function buildSystemPrompt(registry: ToolRegistry): string {
    // 1. 角色设定
    const roleSection = DEFAULT_SYSTEM_PROMPT;

    // 2. 工具列表（从 registry 拿）
    const toolsSection = registry.getAllSchemas();

    // 3. 调用格式规范
    const callingFormatSection = `## 工具调用格式

  当你需要使用工具时，必须严格按以下格式输出：

  Thought: {一句话说明为什么需要这个工具、期望获得什么信息}
  <tool_call>{"name": "工具名", "arguments": {参数对象}}</tool_call>

  收到工具返回结果后，你可以继续调用其他工具，也可以直接给出最终回答。
  如果无需调用工具，直接输出：
  Final Answer: {你的回答}`;

    // 4. 行为规则
    const rulesSection = `## 规则

  1. 先查代码再回答，不要凭空猜测。所有代码相关的结论必须基于工具返回的真实内容。
  2. 工具调用最多 5 次。如果 5 次内无法获取足够信息，输出 Final Answer 并说明缺少什么信息。
  3. 如果用户的问题不需要查看代码（如常识问题），直接输出 Final Answer。
  4. 绝不编造工具返回的结果。只能基于 Observation 中的真实信息回答。`;

    // 5. 拼在一起
    return [roleSection, toolsSection, callingFormatSection, rulesSection].join("\n\n");
}