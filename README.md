# Code Agent — Web 版 AI 代码审查助手

基于 ReAct 架构的 AI Code Review Agent，TypeScript 手写实现，支持流式对话、工具调用、上下文压缩和多模态 RAG。

> **在线地址**：`https://code-agent-rosy.vercel.app`（需 VPN）

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │InputPanel│  │ChatPanel │  │TraceViewer│             │
│  │ 代码+问题│  │ 对话流   │  │ 执行追踪 │              │
│  └────┬─────┘  └────┬─────┘  └──────────┘              │
│       └──────┬──────┘              │                    │
│              │ SSE stream          │                    │
│         useAgent (useReducer) ─────┘                    │
└──────────────┼──────────────────────────────────────────┘
               │
┌──────────────┼──────────────────────────────────────────┐
│  Next.js Server (App Router + API Routes)                │
│              │                                           │
│     /api/agent/stream (SSE)                              │
│              │                                           │
│     ┌────────┴───────┐                                   │
│     │  ReAct Runtime  │  while loop:                     │
│     │                 │  prompt → LLM → parse            │
│     │  react-runtime  │  → execute tool → observe        │
│     │  .ts            │  → loop / final                  │
│     └───┬──────┬──────┘                                  │
│         │      │                                         │
│    ┌────┴──┐ ┌─┴──────────────┐                          │
│    │Memory │ │ ToolExecutor    │                          │
│    ├────────┤ ├────────────────┤                          │
│    │短期记忆│ │ readFile        │                          │
│    │长期记忆│ │ searchCode      │                          │
│    │FileSum │ │ listDirectory   │                          │
│    │裁剪压缩│ │ writeFile       │                          │
│    │        │ │ analyzeCode     │                          │
│    │        │ │ + 安全护栏      │                          │
│    └────────┘ └────┬───────────┘                          │
│                    │                                      │
│           ┌────────┴────────┐                             │
│           │  DeepSeek API   │  Anthropic-compatible       │
│           │  deepseek-v4    │  POST /anthropic/messages   │
│           └─────────────────┘                             │
└──────────────────────────────────────────────────────────┘
```

## 技术栈

| 分类 | 技术 | 说明 |
|------|------|------|
| 框架 | Next.js 15 (App Router) | 全栈框架，SSE API Routes + React Server Components |
| 语言 | TypeScript 5.7 | 全量类型覆盖 |
| AI | DeepSeek v4 (Anthropic 兼容协议) | 通过 `@anthropic-ai/sdk` 调用，baseURL 指向 `api.deepseek.com/anthropic` |
| 样式 | Tailwind CSS v4 + shadcn/ui | 组件库：Button / Textarea / ScrollArea / Collapsible / Sheet |
| 图表 | Lucide React | 图标库 |
| 部署 | Vercel | 一键部署，自动 SSL |

## 目录结构

```
code-agent/
├── src/
│   ├── agent/                         # Agent 核心引擎
│   │   ├── react-runtime.ts           # ReAct 主循环
│   │   ├── plan-execute-runtime.ts    # Plan & Execute 架构
│   │   ├── reflection-runtime.ts      # Reflection 架构
│   │   ├── model-client.ts            # DeepSeek API 封装
│   │   ├── prompt-builder.ts          # System Prompt 组装
│   │   ├── tool-defs.ts              # 5 个工具 Schema 定义
│   │   ├── tools.ts                  # 工具注册中心
│   │   ├── tool-executor.ts          # 工具执行 + 安全护栏
│   │   ├── memory.ts                 # 短期记忆（对话 + File Summary）
│   │   ├── context-manager.ts        # 三层渐进上下文压缩
│   │   ├── durable-memory.ts         # 长期记忆文件持久化
│   │   ├── episodic-notes.ts         # 情景笔记 + 关键词检索
│   │   ├── executor-store.ts         # 工具审批状态管理
│   │   ├── run-store.ts             # Run/Trace 持久化
│   │   ├── workspace.ts             # 项目上下文感知
│   │   └── rag/                      # RAG 子系统
│   │       ├── rag-pipeline.ts       # RAG 主流程编排
│   │       ├── document-loader.ts    # 统一文档加载接口
│   │       ├── multi-format-loader.ts # 多格式文件加载
│   │       ├── mem-vector-store.ts   # 内存级向量存储
│   │       ├── siliconflow-embedding.ts # BGE-M3 Embedding
│   │       ├── mock-embedding.ts     # Mock Embedding（开发用）
│   │       ├── bm25.ts              # BM25 关键词检索
│   │       ├── hybrid-search.ts     # RRF 混合检索融合
│   │       ├── rerank.ts            # BGE-Reranker 重排序
│   │       ├── evaluate.ts          # RAG 评估（Faithfulness + Relevancy）
│   │       ├── types.ts             # RAG 类型定义
│   │       └── parsers/             # 多模态解析器
│   │           ├── text-parser.ts
│   │           ├── pdf-parser.ts
│   │           └── image-parser.ts
│   ├── app/
│   │   ├── layout.tsx               # 根布局（顶栏 + metadata）
│   │   ├── page.tsx                 # 主页面
│   │   ├── globals.css              # 全局样式 + Tailwind
│   │   └── api/
│   │       ├── agent/stream/route.ts # 主 SSE 流式端点
│   │       ├── agent/route.ts       # 非流式 Agent 端点
│   │       ├── agent/approve/route.ts # 工具审批端点
│   │       ├── memory/route.ts      # Durable Memory CRUD
│   │       ├── rag/route.ts         # RAG 检索端点
│   │       ├── chat/route.ts        # 简单对话
│   │       ├── chat-stream/route.ts # 流式对话
│   │       ├── chat-vercel/route.ts # Vercel AI SDK 对话
│   │       ├── plan-execute/route.ts
│   │       └── reflection/route.ts
│   ├── components/
│   │   ├── InputPanel.tsx           # 代码输入 + 问题描述
│   │   ├── ChatPanel.tsx            # 对话面板（消息气泡 + 工具卡片）
│   │   ├── ToolCallCard.tsx         # 可折叠工具调用详情
│   │   ├── TraceViewer.tsx          # 底部抽屉执行追踪
│   │   └── ui/                      # shadcn/ui 组件
│   ├── hooks/
│   │   └── useAgent.ts             # Agent 全局状态管理
│   ├── lib/
│   │   └── utils.ts                # 通用工具函数
│   └── prompts/
│       └── prompt-templates.ts     # Prompt 模板库
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── components.json                  # shadcn/ui 配置
└── package.json
```

## 核心模块

### 1. ReAct 主循环（`react-runtime.ts`）

Agent 核心控制流，实现 Thought → Action → Observation 循环：

```
while (step < maxSteps) {
  1. build prompt（系统提示 + 工具列表 + 代码上下文 + 用户问题 + 对话历史）
  2. 调 DeepSeek API（携带 tools 参数，原生 Tool Use）
  3. 解析响应：
     - tool_use → 校验参数 → 执行 → 追加 observation → 继续循环
     - text/final → 停止循环，返回答案
  4. 更新 Memory + Context Manager
}
```

### 2. 工具执行层（`tool-executor.ts`）

5 个工具 + 安全护栏：

| 工具 | 功能 | 风险等级 |
|------|------|----------|
| `readFile` | 读取文件内容（支持行号范围） | 安全 |
| `searchCode` | 正则搜索代码 | 安全 |
| `listDirectory` | 列出目录结构 | 安全 |
| `writeFile` | 写入文件 | **需审批** |
| `analyzeCode` | 代码静态分析 | 安全 |

安全护栏：
- **路径沙箱**：所有路径收敛到工作区根目录，防 `../` 逃逸
- **重复拦截**：对比上次调用的工具名 + 参数 JSON，完全相同则拒绝
- **敏感脱敏**：扫描环境变量真实值 → 替换为 `<REDACTED>`
- **审批模式**：writeFile 等危险操作需人工确认（SSE 推送审批请求 → 前端按钮 → resolve）

### 3. Memory 系统（`memory.ts` + `durable-memory.ts`）

三层记忆架构：

```
┌────────────────────┐
│  短期记忆 (Memory)   │  对话历史 + File Summary + SHA256 新鲜度校验
├────────────────────┤
│  上下文压缩 (Context) │  三层渐进：近期完整 / 中期截断 / 远期摘要
├────────────────────┤
│  长期记忆 (Durable)  │  文件持久化 + 主题分类 + 主语去重 + API 端点
└────────────────────┘
```

### 4. 上下文裁剪（`context-manager.ts`）

当对话轮次增多、prompt 逼近 token 上限时自动触发：

- **近期（≤3 轮）**：保留完整消息
- **中期（4-6 轮）**：保留消息但内容截断至 180 字符
- **远期（>6 轮）**：整轮替换为一句话摘要

实测数据：11 轮对话 5587 → 985 tokens，压缩率 82%。

### 5. RAG 子系统（`rag/`）

完整的检索增强生成流水线：

```
文档上传 → MultiFormatLoader（text/pdf/image）
         → RecursiveSplitter（递归切分，chunk=500, overlap=50）
         → BGE-M3 Embedding（SiliconFlow API）
         → MemVectorStore（内存级向量存储）
         → HybridSearch（BM25 + 向量 + RRF 融合）
         → BGE-Reranker 重排序
         → Prompt 组装（角色 → 文档+来源 → 规则 → 问题）
```

评估指标：Faithfulness（拆断言逐条验证）+ Answer Relevancy（反向生成问题对比）

## 本地运行

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 安装与启动

```bash
# 1. 进入项目目录
cd code-agent

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入：
#   ANTHROPIC_API_KEY=your-deepseek-api-key
#   SILICONFLOW_API_KEY=your-siliconflow-api-key

# 4. 启动开发服务器
npm run dev

# 5. 浏览器打开
open http://localhost:3000
```

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（热更新） |
| `npm run build` | 生产构建 + 类型检查 |
| `npm start` | 启动生产服务器 |
| `npm run lint` | ESLint 代码检查 |

## 设计决策（ADR）

### 1. 手写 ReAct vs LangChain

**选择手写。** 面试能讲清每一行代码的执行逻辑，展示对 Agent 原理的深层理解。LangChain 封装了太多细节，用它做项目面试时会被追问"你知不知道底层怎么做的"。

### 2. DeepSeek vs Claude

**选择 DeepSeek。** 支持 Anthropic Messages API 兼容协议（`api.deepseek.com/anthropic`），成本不到 Claude 的 1/10。架构上预留了模型切换扩展点——`ModelClient` 接口只需换一个实现类。

### 3. 内存级向量存储 vs Chroma/Pinecone

**选择内存级。** 代码审查场景的文档量通常不大（几十个文件以内），内存级 cos 相似度遍历完全够用。面试可以补充："生产环境会换成 Pinecone 或 pgvector，但架构上 VectorStore 接口已抽象好，换存储只改一个类。"

### 4. 递归切分 vs 语义切分

**选择递归切分。** 代码文件有自然的分隔符（换行、函数边界），递归切分按 `\n\n` → `\n` → ` ` 优先级依次切分，不会把函数拦腰截断。语义切分需要额外的 Embedding 模型做句子边界检测，增加了延迟和成本，对代码场景收益不大。

### 5. 余弦相似度 vs 欧氏距离

**选择余弦相似度。** BGE-M3 输出的 Embedding 向量归一化后，余弦相似度只关注方向而非长度。两个内容相似的文档，向量方向一致但长度可能因文本长度不同而有差异——欧氏距离会被长度误导，余弦不会。

### 6. SSE 流式 vs WebSocket

**选择 SSE。** Agent 对话是单向流（服务端 → 客户端），不需要双向通信。SSE 比 WebSocket 更轻量：HTTP 原生支持、自动重连、不需要额外的握手协议。Next.js API Routes 对 SSE 有原生支持。

### 7. 上下文三层压缩

**选择渐进压缩而非一刀切。** 一刀切（滑动窗口）会丢失老旧但重要的信息（如用户最初的问题）。三层压缩保留近期对话的完整性，同时用摘要保留远期语义——11 轮对话压缩 82% token 用量的同时保持回答质量不变。

## 部署

项目通过 Vercel CLI 部署，关联 GitHub 后可实现 `git push` 自动上线。

需要配置的环境变量：

| 变量名 | 说明 |
|--------|------|
| `ANTHROPIC_API_KEY` | DeepSeek API Key（通过 Anthropic 兼容协议调用） |
| `SILICONFLOW_API_KEY` | SiliconFlow API Key（BGE-M3 Embedding + BGE-Reranker） |

```bash
# CLI 部署
vercel --env ANTHROPIC_API_KEY=xxx --env SILICONFLOW_API_KEY=xxx --prod
```

## License

MIT
