[English](./README.md) | **🇨🇳 简体中文**

# Code Agent — AI 代码审查平台

从零手写的团队代码审查 Agent 平台，TypeScript 全栈实现。支持三种 Agentic 架构（ReAct / Plan & Execute / Reflection）、异步 PR 审查、人在环评估标注、SSE 流式输出。

> **在线地址**：[code-agent-j3fznqof2-zoella-ws-projects.vercel.app](https://code-agent-j3fznqof2-zoella-ws-projects.vercel.app)

## 架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│  浏览器                                                               │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ TaskSidebar │  │ InputPanel   │  │ ResultPanel  │                  │
│  │ 多任务管理  │  │ 代码 / PR    │  │ 流式结果     │                  │
│  │             │  │ URL 输入     │  │ + 标注面板   │                  │
│  └────────────┘  └──────┬───────┘  └──────┬───────┘                  │
│                         │                 │                           │
│                    useAgent (useReducer) ──┘                           │
│                    + 防滥用限流 (localStorage)                          │
└─────────────────────────┼────────────────────────────────────────────┘
                          │ SSE 流
┌─────────────────────────┼────────────────────────────────────────────┐
│  Next.js 15 (App Router)                                              │
│                          │                                            │
│  ┌───────────────────────┴──────────────────────────┐                │
│  │  编排流 (Orchestrate Stream)                       │                │
│  │  dispatch(mode) → phase: executing                │                │
│  │    ├─ react-runtime        (ReAct 循环)           │                │
│  │    ├─ plan-execute-runtime (规划→执行→总结)        │                │
│  │    └─ reflection-runtime   (执行→评估→反思)        │                │
│  │  → phase: verifying（可选）                        │                │
│  │    └─ 独立验证器审视输出质量                        │                │
│  └───────────────────┬──────────────────────────────┘                │
│                      │                                               │
│  ┌──────────┐  ┌─────┴──────┐  ┌──────────────┐                      │
│  │  记忆系统 │  │  工具执行   │  │  安全护栏     │                     │
│  │  ├─短期   │  │  ├─读文件   │  │  ├─路径沙箱   │                    │
│  │  ├─上下文 │  │  ├─搜索代码 │  │  ├─重复拦截   │                    │
│  │  └─持久化 │  │  ├─列目录   │  │  ├─敏感脱敏   │                    │
│  └──────────┘  │  ├─写文件   │  │  └─审批模式   │                      │
│                │  └─代码分析 │  └──────────────┘                      │
│                └─────┬──────┘                                         │
│                      │                                               │
│  ┌───────────────────┴───────────────────┐                           │
│  │  PostgreSQL (Prisma)                   │                           │
│  │  ├─ Task（多任务持久化）                │                           │
│  │  ├─ Evaluation（人工标注）              │                           │
│  │  ├─ PrReview（PR diff 缓存）            │                           │
│  │  └─ UsageLimit（防滥用限流）             │                           │
│  └───────────────────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘
```

## 技术栈

| 层 | 技术 | 说明 |
|-----|------|------|
| 框架 | Next.js 15 (App Router) | API Routes、SSE 流式、React 19 |
| 语言 | TypeScript 5.7 | 严格模式、全量类型覆盖 |
| 样式 | Tailwind CSS v4 + shadcn/ui | 深色模式、设计 token、响应式 |
| 图标 | Lucide React | 统一图标体系 |
| 数据库 | PostgreSQL (Prisma ORM v7) | Pg adapter、Neon serverless |
| AI SDK | `@anthropic-ai/sdk` | DeepSeek v4（兼容 Anthropic 协议） |
| Embedding | BGE-M3 (SiliconFlow API) | 1024 维向量 |
| 部署 | Vercel | git push 自动上线 |

## 快速开始

```bash
git clone https://github.com/Zoella-w/code-agent.git
cd code-agent
npm install
```

创建 `.env.local`：

```env
ANTHROPIC_API_KEY=your-deepseek-api-key
SILICONFLOW_API_KEY=your-siliconflow-api-key
DATABASE_URL=your-postgres-connection-string
MODEL_PROVIDER=deepseek              # deepseek | claude
DEMO_OWNER_SECRET=your-random-secret # 可选，作者豁免密钥
```

```bash
npx prisma db push    # 同步数据库结构
npm run dev           # 启动 → http://localhost:3000
```

## 目录结构

```
src/
├── agent/                        # Agent 核心引擎
│   ├── orchestrate.ts            # 统一编排入口（模式分发 + 可选验证环）
│   ├── react-runtime.ts          # ReAct 主循环（思考→行动→观察）
│   ├── plan-execute-runtime.ts   # Plan & Execute（规划→执行→总结）
│   ├── reflection-runtime.ts     # Reflection（执行→评估→反思，≤3 轮）
│   ├── model-client.ts           # LLM 客户端（兼容 Anthropic 协议）
│   ├── prompt-builder.ts         # System Prompt 组装
│   ├── tool-defs.ts              # 5 工具 Schema 定义
│   ├── tools.ts                  # 工具注册中心
│   ├── tool-executor.ts          # 工具执行 + 安全护栏
│   ├── memory.ts                 # 短期记忆（对话 + 文件摘要）
│   ├── context-manager.ts        # 三层渐进上下文压缩
│   ├── durable-memory.ts         # 长期记忆（文件持久化）
│   ├── episodic-notes.ts         # 情景笔记（12 条上限 + 标签加权检索）
│   ├── executor-store.ts         # 审批模式状态管理
│   ├── run-store.ts              # Run/Trace 持久化
│   ├── workspace.ts              # Git 感知的项目上下文扫描
│   ├── eval-store.ts             # 人在环评估样本
│   └── rag/                      # RAG 子系统
│       ├── rag-pipeline.ts
│       ├── document-loader.ts
│       ├── multi-format-loader.ts
│       ├── mem-vector-store.ts
│       ├── siliconflow-embedding.ts
│       ├── bm25.ts
│       ├── hybrid-search.ts       # RRF 混合检索融合
│       ├── rerank.ts              # BGE-Reranker 重排序
│       ├── evaluate.ts            # Faithfulness + Answer Relevancy
│       └── parsers/               # text / pdf / image 解析器
├── app/
│   ├── layout.tsx                # 根布局（品牌顶栏 + 主题切换）
│   ├── page.tsx                  # 主页面（三栏布局）
│   ├── globals.css               # 设计 token + 深色模式
│   └── api/agent/
│       ├── orchestrate/route.ts  # 主 SSE 端点（全模式）
│       ├── pr-review/route.ts    # GitHub PR 审查端点
│       ├── pr-comment/route.ts   # 发布 PR Comment
│       ├── approve/route.ts      # 工具审批确认
│       ├── eval/route.ts         # 评估标注 CRUD
│       ├── tasks/route.ts        # 任务持久化
│       └── memory/route.ts       # 长期记忆 CRUD
├── components/
│   ├── InputPanel.tsx            # 代码编辑器 + PR URL + 模式选择
│   ├── ResultPanel.tsx           # 四态展示（空闲/运行/完成/错误）
│   ├── TaskSidebar.tsx           # 多任务管理
│   ├── TraceViewer.tsx           # 执行追踪底部抽屉
│   ├── ToolCallCard.tsx          # 可折叠工具调用详情
│   ├── EvalDashboard.tsx         # 评估统计面板
│   ├── EvalLabeler.tsx           # 人工标注提交
│   ├── MarkdownRenderer.tsx      # Markdown 渲染 + 语法高亮
│   ├── tool-icons.ts             # Lucide 图标映射
│   ├── theme-provider.tsx        # 深色/浅色主题 Context
│   └── ui/                       # shadcn/ui 基础组件
├── hooks/
│   ├── useAgent.ts               # 全局状态 + SSE 消费 + 限流
│   └── useDarkMode.ts            # 响应式深色模式
├── lib/
│   ├── prisma.ts                 # Prisma 单例
│   ├── usage-limit.ts            # IP 限流（原子 upsert）
│   └── utils.ts                  # cn() 工具函数
└── prompts/
    └── prompt-templates.ts       # Prompt 模板库
```

## 核心功能

### 三种 Agentic 架构

| 模式 | 机制 | 适用场景 |
|------|------|----------|
| **ReAct** | 思考 → 行动 → 观察 循环 | 通用代码审查 |
| **Plan & Execute** | 制定计划 → 逐步执行 → 总结 | 复杂多步分析 |
| **Reflection** | 执行 → 评估 → 反思（≤3 轮） | 需要自我纠错的审查 |

### 可选验证环

任意模式执行完毕后，**独立的验证器** LLM 会审视输出：逐条检查真实问题、遗漏、误报，输出结构化 `VERDICT: PASS / FAIL` 及详细报告。这是后置质量闸门——与 Reflection 架构的内部自我改进循环正交，可叠加使用。

### 工具系统 + 安全护栏

| 工具 | 功能 | 风险 |
|------|------|------|
| `read_file` | 按行号读取文件 | 安全 |
| `search_code` | 正则搜索代码 | 安全 |
| `list_directory` | 递归列目录 | 安全 |
| `write_file` | 写入文件 | **需审批** |
| `analyze_code` | 内存级代码分析 | 安全 |

- **路径沙箱**：所有路径收敛到工作区根目录
- **重复调用拦截**：相同工具+参数 JSON 比对，阻止死循环
- **敏感脱敏**：扫描 env 真实值 → 输出替换为 `<REDACTED>`
- **审批模式**：危险操作需人工确认（SSE 推送 → 前端按钮 → resolve）

### 记忆系统

```
短期记忆 → 对话历史 + 文件摘要 + SHA256 新鲜度校验
上下文压缩 → 三层渐进：近期完整 / 中期截断 / 远期摘要
持久记忆   → 文件持久化 + 主题分类 + 主语去重 + API 端点
情景笔记   → 12 条上限 + 标签加权关键词检索
```

### 上下文压缩

| 层级 | 范围 | 策略 |
|------|------|------|
| 近期 | ≤ 3 轮 | 保留完整消息 |
| 中期 | 4–6 轮 | 内容截断至 180 字符 |
| 远期 | > 6 轮 | 整轮替换为一句话摘要 |

**实测**：11 轮对话，5,587 → 985 tokens（压缩率 82%）。

### RAG 流水线

```
上传 → MultiFormatLoader（text/pdf/image）
     → RecursiveSplitter（chunk=500, overlap=50）
     → BGE-M3 Embedding（1024 维）
     → MemVectorStore
     → HybridSearch（BM25 + 向量 + RRF 融合）
     → BGE-Reranker 重排序
     → Prompt 组装（角色 → 文档+来源 → 规则 → 问题）
```

评估指标：**Faithfulness**（拆断言逐条验证）+ **Answer Relevancy**（反向生成问题对比打分）。

### 人在环评估（Eval 飞轮）

每次审查结果可标注为**准确 / 误报 / 部分准确**并附带说明。标注落 PostgreSQL，驱动实时准确率面板。形成闭环：人工反馈 → 准确率追踪 → 模型/Prompt 优化。

### 防滥用限流

按 IP 限流（3 次请求），PostgreSQL 原子 upsert 计数。前端 localStorage 在调用 API 前先行拦截；后端在 LLM 调用前执行硬闸。PR 审查仅在 diff 拉取成功后才计费。作者通过 `DEMO_OWNER_SECRET` + `x-demo-owner` header 豁免。

## 设计决策（ADR）

### 1. 手写 Agent vs LangChain

**选择手写。** 面试能讲清 ReAct 循环、工具执行、Prompt 组装的每一行代码。LangChain 封装太深——用它做项目面试官会追问底层原理。

### 2. DeepSeek vs Claude

**选择 DeepSeek。** 支持 Anthropic Messages API 兼容协议，成本不到 Claude 十分之一。`ModelClient` 接口抽象了提供商——切换只需换一个实现类。

### 3. 三种架构、一个编排入口

**统一 dispatch。** 编排层（`orchestrate.ts`）根据 mode 路由到对应 Runtime，再可选叠加验证环。API 层面点干净，同时展示架构深度。

### 4. 验证环与 Reflection 的差异化设计

**Reflection** 是执行策略（Runtime 内部自纠正）。**验证环** 是后置质量闸门（独立 LLM 审视输出）。两者正交、可叠加：Reflection 迭代改进内部质量，验证环提供外部可信度信号。

### 5. SSE 而非 WebSocket

**选择 SSE。** Agent 输出是单向流。SSE 比 WebSocket 更轻量：HTTP 原生、自动重连、无握手开销。Next.js API Routes 原生支持。

### 6. 内存级向量存储

**内存优先。** 代码审查场景文档量小（几十个文件）。`VectorStore` 接口已抽象——换 Pinecone 或 pgvector 只改一个实现类。

### 7. 余弦相似度而非欧氏距离

**选择余弦。** BGE-M3 向量归一化后，余弦只关注方向。两段语义相似的文字，向量长度可能因文本长度不同而有差异——欧氏距离会被长度误导，余弦不会。

### 8. 三层渐进压缩而非滑动窗口

**选择渐进。** 一刀切（滑动窗口）会丢失老旧但关键的信息（如用户最初的问题）。三层压缩保留近期对话完整性，同时用摘要保留远期语义——82% token 压缩率、回答质量不变。

## 部署

Vercel 部署，关联 GitHub 后 `git push` 自动上线。所需环境变量：

| 变量 | 用途 |
|------|------|
| `ANTHROPIC_API_KEY` | DeepSeek API Key（兼容 Anthropic 协议） |
| `SILICONFLOW_API_KEY` | SiliconFlow API Key（BGE-M3 + Reranker） |
| `DATABASE_URL` | PostgreSQL 连接串（Neon serverless） |
| `MODEL_PROVIDER` | `deepseek` 或 `claude` |
| `DEMO_OWNER_SECRET` | 作者豁免密钥（可选） |

## License

MIT
