**🇬🇧 English** | [🇨🇳 简体中文](./README.zh-CN.md)

# Code Agent — AI-Powered Code Review Platform

A team-oriented code review agent platform built from scratch with TypeScript. Supports three agentic architectures (ReAct / Plan & Execute / Reflection), asynchronous PR review, human-in-the-loop evaluation, and streaming SSE output.

> **Live Demo**: [code-agent-j3fznqof2-zoella-ws-projects.vercel.app](https://code-agent-j3fznqof2-zoella-ws-projects.vercel.app)

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ TaskSidebar │  │ InputPanel   │  │ ResultPanel  │                  │
│  │ multi-task  │  │ code + PR    │  │ agent stream │                  │
│  │ management  │  │ URL input    │  │ + eval label │                  │
│  └────────────┘  └──────┬───────┘  └──────┬───────┘                  │
│                         │                 │                           │
│                    useAgent (useReducer) ──┘                           │
│                    + usage limit (localStorage)                        │
└─────────────────────────┼────────────────────────────────────────────┘
                          │ SSE stream
┌─────────────────────────┼────────────────────────────────────────────┐
│  Next.js 15 (App Router)                                              │
│                          │                                            │
│  ┌───────────────────────┴──────────────────────────┐                │
│  │  Orchestrate Stream                               │                │
│  │  dispatch(mode) → phase: executing                │                │
│  │    ├─ react-runtime       (while loop)            │                │
│  │    ├─ plan-execute-runtime (plan → exec → summary)│                │
│  │    └─ reflection-runtime  (actor → eval → reflect)│                │
│  │  → phase: verifying (optional)                    │                │
│  │    └─ independent verifier checks output quality   │                │
│  └───────────────────┬──────────────────────────────┘                │
│                      │                                               │
│  ┌──────────┐  ┌─────┴──────┐  ┌──────────────┐                      │
│  │  Memory   │  │  Tool Exec │  │  Safety       │                     │
│  │  ├─short  │  │  ├─readFile│  │  ├─path sandbox│                    │
│  │  ├─context│  │  ├─search  │  │  ├─dedup check │                    │
│  │  └─durable│  │  ├─listDir │  │  ├─secret redact│                   │
│  └──────────┘  │  ├─write   │  │  └─approval   │                      │
│                │  └─analyze │  └──────────────┘                      │
│                └─────┬──────┘                                         │
│                      │                                               │
│  ┌───────────────────┴───────────────────┐                           │
│  │  PostgreSQL (Prisma)                   │                           │
│  │  ├─ Task (multi-session persistence)   │                           │
│  │  ├─ Evaluation (human labels)          │                           │
│  │  ├─ PrReview (PR diff cache)           │                           │
│  │  └─ UsageLimit (rate limiting)          │                           │
│  └───────────────────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router) | API Routes, SSE streaming, React 19 |
| Language | TypeScript 5.7 | Strict mode, full type coverage |
| Styling | Tailwind CSS v4 + shadcn/ui | Dark mode, design tokens, responsive |
| Icons | Lucide React | Consistent icon system |
| Database | PostgreSQL (Prisma ORM v7) | Pg adapter, Neon serverless |
| AI SDK | `@anthropic-ai/sdk` | DeepSeek v4 via Anthropic-compatible protocol |
| Embedding | BGE-M3 (SiliconFlow API) | 1024-dim vectors |
| Deployment | Vercel | Auto-deploy on push |

## Quick Start

```bash
git clone https://github.com/Zoella-w/code-agent.git
cd code-agent
npm install
```

Create `.env.local`:

```env
ANTHROPIC_API_KEY=your-deepseek-api-key
SILICONFLOW_API_KEY=your-siliconflow-api-key
DATABASE_URL=your-postgres-connection-string
MODEL_PROVIDER=deepseek              # deepseek | claude
DEMO_OWNER_SECRET=your-random-secret # optional, for usage-limit bypass
```

```bash
npx prisma db push    # sync schema to database
npm run dev           # start at http://localhost:3000
```

## Project Structure

```
src/
├── agent/                        # Core Agent Engine
│   ├── orchestrate.ts            # Unified orchestration entry (mode dispatch + optional verify)
│   ├── react-runtime.ts          # ReAct loop: Thought → Action → Observation
│   ├── plan-execute-runtime.ts   # Plan & Execute: plan → exec steps → summarize
│   ├── reflection-runtime.ts     # Reflection: actor → evaluator → reflector (≤3 rounds)
│   ├── model-client.ts           # LLM client (Anthropic-compatible, multi-provider)
│   ├── prompt-builder.ts         # System prompt assembly
│   ├── tool-defs.ts              # 5-tool schema definitions
│   ├── tools.ts                  # Tool registry (getAllNames / getAllDefs)
│   ├── tool-executor.ts          # Tool execution + safety guardrails
│   ├── memory.ts                 # Short-term memory (conversation + file summaries)
│   ├── context-manager.ts        # 3-tier progressive context compression
│   ├── durable-memory.ts         # Long-term memory (file persistence)
│   ├── episodic-notes.ts         # Episodic notes (12-cap, tag-weighted retrieval)
│   ├── executor-store.ts         # Approval mode state management
│   ├── run-store.ts              # Run/trace persistence (JSONL + JSON)
│   ├── workspace.ts              # Git-aware project context scanner
│   ├── eval-store.ts             # Human-label evaluation samples
│   └── rag/                      # RAG subsystem
│       ├── rag-pipeline.ts
│       ├── document-loader.ts
│       ├── multi-format-loader.ts
│       ├── mem-vector-store.ts
│       ├── siliconflow-embedding.ts
│       ├── bm25.ts
│       ├── hybrid-search.ts       # RRF fusion
│       ├── rerank.ts              # BGE-Reranker
│       ├── evaluate.ts            # Faithfulness + Answer Relevancy
│       └── parsers/               # text / pdf / image parsers
├── app/
│   ├── layout.tsx                # Root layout (branded header + theme toggle)
│   ├── page.tsx                  # Main page (3-panel layout)
│   ├── globals.css               # Design tokens + dark mode
│   └── api/agent/
│       ├── orchestrate/route.ts  # Main SSE endpoint (all modes)
│       ├── pr-review/route.ts    # GitHub PR review endpoint
│       ├── pr-comment/route.ts   # Post review as PR comment
│       ├── approve/route.ts      # Tool approval resolution
│       ├── eval/route.ts         # Evaluation CRUD
│       ├── tasks/route.ts        # Task persistence
│       └── memory/route.ts       # Durable memory CRUD
├── components/
│   ├── InputPanel.tsx            # Code editor + PR URL + mode selector
│   ├── ResultPanel.tsx           # 4-state display (idle/running/done/error)
│   ├── TaskSidebar.tsx           # Multi-task management
│   ├── TraceViewer.tsx           # Execution trace bottom sheet
│   ├── ToolCallCard.tsx          # Collapsible tool call detail card
│   ├── EvalDashboard.tsx         # Evaluation statistics
│   ├── EvalLabeler.tsx           # Human label submission
│   ├── MarkdownRenderer.tsx      # Markdown with syntax highlighting
│   ├── tool-icons.ts             # Lucide icon mapping for tools
│   ├── theme-provider.tsx        # Dark/light theme context
│   └── ui/                       # shadcn/ui primitives
├── hooks/
│   ├── useAgent.ts               # Global state (useReducer) + SSE consumption + usage limit
│   └── useDarkMode.ts            # Reactive dark mode detection
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── usage-limit.ts            # IP-based rate limiting (atomic upsert)
│   └── utils.ts                  # cn() helper
└── prompts/
    └── prompt-templates.ts       # Reusable prompt library
```

## Features

### Three Agentic Architectures

| Mode | Mechanism | Best For |
|------|-----------|----------|
| **ReAct** | Thought → Action → Observation loop | General code review |
| **Plan & Execute** | Plan steps → Execute each → Summarize | Complex multi-step analysis |
| **Reflection** | Actor → Evaluator → Reflector (≤3 rounds) | Self-correcting reviews |

### Optional Verification Ring

After any mode completes, an **independent verifier** LLM inspects the output for false positives, missed issues, and overall quality. Outputs a structured `VERDICT: PASS / FAIL` with a detailed report. This is a post-hoc quality gate — orthogonal to the Reflection architecture's internal self-improvement loop.

### Tool System with Safety Guardrails

| Tool | Function | Risk |
|------|----------|------|
| `read_file` | Read file with line range | Safe |
| `search_code` | Regex code search | Safe |
| `list_directory` | Recursive directory listing | Safe |
| `write_file` | Write to file system | **Requires approval** |
| `analyze_code` | In-memory static analysis | Safe |

- **Path sandbox**: All paths converge to workspace root
- **Duplicate detection**: Identical tool+args calls blocked
- **Secret redaction**: Scans env values → replaces in output
- **Approval mode**: Dangerous operations require human confirmation via SSE

### Memory Architecture

```
Short-term (memory.ts)    → Conversation history + File summaries + SHA256 freshness
Context (context-manager.ts) → 3-tier compression: recent full / mid truncated / far summarized
Durable (durable-memory.ts) → File persistence + topic classification + dedup + API endpoint
Episodic (episodic-notes.ts) → 12-entry cap + tag-weighted keyword retrieval
```

### Context Compression

| Tier | Range | Strategy |
|------|-------|----------|
| Recent | ≤ 3 turns | Keep full messages |
| Mid | 4–6 turns | Truncate content to 180 chars |
| Far | > 6 turns | Replace entire turn with one-line summary |

**Measured**: 11 turns, 5,587 → 985 tokens (82% compression).

### RAG Pipeline

```
Upload → MultiFormatLoader (text/pdf/image)
       → RecursiveSplitter (chunk=500, overlap=50)
       → BGE-M3 Embedding (SiliconFlow, 1024-dim)
       → MemVectorStore
       → HybridSearch (BM25 + vector + RRF fusion)
       → BGE-Reranker
       → Prompt assembly (role → docs+sources → rules → question)
```

Evaluation: **Faithfulness** (atomic claim verification) + **Answer Relevancy** (reverse question generation scoring).

### Human-in-the-Loop Evaluation

Every review output can be labeled as **accurate / inaccurate / partial** with optional comments. Labels persist to PostgreSQL and feed a real-time accuracy dashboard. This closes the eval flywheel: human feedback → accuracy tracking → model/prompt improvement.

### Usage Limiting

Per-IP rate limiting (3 requests) with atomic PostgreSQL upsert. The frontend intercepts via localStorage before any API call; the backend enforces at the route level before any LLM invocation. PR review mode only counts after a successful diff fetch (failed pulls don't consume quota). Author exemption via `DEMO_OWNER_SECRET` + `x-demo-owner` header.

## Design Decisions (ADRs)

### 1. Hand-written Agent vs LangChain

**Hand-written.** Every line of the ReAct loop, tool execution, and prompt assembly is explainable in an interview. LangChain abstracts away the internals — you can't talk about what you didn't build.

### 2. DeepSeek vs Claude

**DeepSeek.** Supports Anthropic Messages API compatibility (`api.deepseek.com/anthropic`), costs < 1/10 of Claude. The `ModelClient` interface abstracts the provider — switching is a one-class change.

### 3. Three Architectures, One Orchestration Entry

**Unified dispatch.** The orchestration layer (`orchestrate.ts`) routes to the correct runtime based on `mode`, then optionally runs the verification ring. This keeps the API surface clean (one endpoint) while demonstrating architectural depth.

### 4. Separating Verification from Reflection

**Reflection** is an execution strategy (self-correct within the runtime). **Verification** is a post-hoc quality gate (independent LLM inspects output). They are orthogonal and stackable: Reflection iterates to improve internally, Verification provides an external trust signal.

### 5. SSE over WebSocket

**SSE.** Agent output is a unidirectional stream (server → client). SSE is lighter than WebSocket: native HTTP, automatic reconnection, no handshake overhead. Next.js API Routes support it natively.

### 6. In-memory Vector Store

**In-memory for now.** Code review datasets are typically small (tens of files). The `VectorStore` interface is abstracted — swapping to Pinecone or pgvector is a one-class change, not an architecture rewrite.

### 7. Cosine Similarity over Euclidean Distance

**Cosine.** BGE-M3 vectors are normalized — cosine measures direction, not magnitude. Two semantically similar documents can have different vector lengths due to text length variance. Euclidean distance gets misled by length; cosine doesn't.

### 8. Progressive Compression over Sliding Window

**Progressive.** A sliding window drops old but critical information (e.g., the user's original question). Three-tier compression preserves recent conversation fidelity while summarizing distant turns semantically — 82% token reduction without quality loss.

## Deployment

Deployed on Vercel with automatic `git push` deploy. Required environment variables:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | DeepSeek API key (Anthropic-compatible protocol) |
| `SILICONFLOW_API_KEY` | SiliconFlow API key (BGE-M3 + Reranker) |
| `DATABASE_URL` | PostgreSQL connection string (Neon serverless) |
| `MODEL_PROVIDER` | `deepseek` or `claude` |
| `DEMO_OWNER_SECRET` | Author bypass key for usage limit (optional) |

## License

MIT
