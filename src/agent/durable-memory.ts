import * as fs from "node:fs";
import path from "node:path";

/** 默认主题定义（参考 pico DURABLE_TOPIC_DEFAULTS） */
const DURABLE_TOPIC_DEFAULTS: Record<string, { title: string; tags: string[] }> = {
    "project-conventions": { title: "Project Conventions", tags: ["convention"] },
    "key-decisions": { title: "Key Decisions", tags: ["decision"] },
    "dependency-facts": { title: "Dependency Facts", tags: ["dependency"] },
    "user-preferences": { title: "User Preferences", tags: ["preference"] },
};

interface TopicEntry {
    slug: string;
    title: string;
    summary: string;
    tags: string[];
}

/** 持久化记忆存储：文件系统保存，跨会话保留（参考 pico DurableMemoryStore） */
export class DurableMemoryStore {
    private root: string;
    private indexPath: string;
    private topicsDir: string;

    constructor(storageRoot: string) {
        this.root = storageRoot;
        this.indexPath = path.join(storageRoot, "MEMORY.md");
        this.topicsDir = path.join(storageRoot, "topics");
    }

    /** 确保 .agent/memory/ 目录存在 */
    ensureDir(): void {
        fs.mkdirSync(this.topicsDir, { recursive: true });
        if (!fs.existsSync(this.indexPath)) {
            this.writeIndex([]);
        }
    }

    /** 解析 MEMORY.md 获取主题列表 */
    loadIndex(): TopicEntry[] {
        if (!fs.existsSync(this.indexPath)) return [];
        const content = fs.readFileSync(this.indexPath, "utf-8");
        const topics: TopicEntry[] = [];
        let current: Partial<TopicEntry> | null = null;
        for (const line of content.split("\n")) {
            const linkMatch = line.match(/^- \[(.+?)\]\(topics\/(.+?)\.md\): (.+)$/);
            if (linkMatch) {
                if (current && current.slug) topics.push(current as TopicEntry);
                current = { slug: linkMatch[1], title: linkMatch[2] === "" ? linkMatch[1] : linkMatch[3], summary: "", tags: [] };
                continue;
            }
            if (current) {
                const summaryMatch = line.match(/^\s*-\s*summary:\s*(.+)$/);
                const tagsMatch = line.match(/^\s*-\s*tags:\s*(.+)$/);
                if (summaryMatch) current.summary = summaryMatch[1].trim();
                if (tagsMatch) current.tags = tagsMatch[1].split(",").map((t) => t.trim());
            }
        }
        if (current && current.slug) topics.push(current as TopicEntry);
        return topics;
    }

    /** 写入 MEMORY.md 索引文件 */
    private writeIndex(topics: TopicEntry[]): void {
        const lines = ["# Durable Memory Index", ""];
        for (const t of topics) {
            lines.push(`- [${t.slug}](topics/${t.slug}.md): ${t.title}`);
            lines.push(`  - summary: ${t.summary}`);
            lines.push(`  - tags: ${t.tags.join(", ")}`);
        }
        fs.mkdirSync(this.root, { recursive: true });
        fs.writeFileSync(this.indexPath, lines.join("\n").trimEnd() + "\n", "utf-8");
    }

    /** 读取某个主题下的所有笔记 */
    loadTopicNotes(slug: string): string[] {
        const filePath = path.join(this.topicsDir, `${slug}.md`);
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, "utf-8");
        const notes: string[] = [];
        let inNotes = false;
        for (const line of content.split("\n")) {
            if (line.startsWith("## Notes")) { inNotes = true; continue; }
            if (inNotes && line.startsWith("- ")) {
                notes.push(line.slice(2));
            }
        }
        return notes;
    }

    /** 写入单个主题文件 */
    private writeTopic(slug: string, notes: string[]): void {
        const meta = DURABLE_TOPIC_DEFAULTS[slug] ?? { title: slug, tags: [] };
        const lines = [
            `# ${meta.title}`,
            "",
            `- topic: ${slug}`,
            `- summary: ${meta.title}`,
            `- tags: ${meta.tags.join(", ")}`,
            `- updated_at: ${new Date().toISOString()}`,
            "",
            "## Notes",
        ];
        for (const note of notes) {
            lines.push(`- ${note}`);
        }
        fs.mkdirSync(this.topicsDir, { recursive: true });
        fs.writeFileSync(path.join(this.topicsDir, `${slug}.md`), lines.join("\n").trimEnd() + "\n", "utf-8");
    }

    /** 提取笔记主语用于去重（参考 pico _subject_key） */
    private subjectKey(note: string): string | null {
        const patterns = [" uses ", " should ", " prefers ", " is ", " are ", "：", "：", "使用", "应该", "偏好"];
        for (const p of patterns) {
            const idx = note.indexOf(p);
            if (idx > 0) return note.slice(0, idx).trim().toLowerCase();
        }
        return note.slice(0, 40).trim().toLowerCase();
    }

    /** 持久化笔记：按 topic 分类存储，同主语自动替换旧笔记 */
    promote(promotions: [string, string][]): string[] {
        if (promotions.length === 0) return [];
        this.ensureDir();
        const topics = this.loadIndex();
        const topicMap = new Map<string, TopicEntry>();
        for (const t of topics) topicMap.set(t.slug, t);
        const notesCache = new Map<string, string[]>();
        const promoted: string[] = [];

        for (const [topic, noteText] of promotions) {
            if (!topicMap.has(topic)) {
                const def = DURABLE_TOPIC_DEFAULTS[topic] ?? { title: topic, tags: [] };
                topicMap.set(topic, { slug: topic, title: def.title, summary: def.title, tags: def.tags });
            }
            if (!notesCache.has(topic)) {
                notesCache.set(topic, this.loadTopicNotes(topic));
            }
            const existing = notesCache.get(topic)!;
            const newSubject = this.subjectKey(noteText);
            let replaced = false;
            if (newSubject) {
                for (let i = 0; i < existing.length; i++) {
                    if (this.subjectKey(existing[i]) === newSubject) {
                        existing[i] = noteText;
                        replaced = true;
                        break;
                    }
                }
            }
            if (!replaced) {
                existing.push(noteText);
            }
            promoted.push(noteText);
        }

        const allTopics = Array.from(topicMap.values()).sort((a, b) => a.slug.localeCompare(b.slug));
        this.writeIndex(allTopics);
        for (const [slug, notes] of notesCache) {
            this.writeTopic(slug, notes);
        }
        return promoted;
    }

    /** 关键词检索：按标签和文本匹配返回相关笔记 */
    retrievalCandidates(query: string, limit: number = 3): { text: string; tags: string[]; source: string }[] {
        const topics = this.loadIndex();
        const queryTokens = query.toLowerCase().split(/\s+/);
        const results: { text: string; tags: string[]; source: string; score: number }[] = [];

        for (const t of topics) {
            const notes = this.loadTopicNotes(t.slug);
            for (const note of notes) {
                const noteLower = note.toLowerCase();
                let score = 0;
                for (const token of queryTokens) {
                    if (noteLower.includes(token)) score += 1;
                }
                for (const tag of t.tags) {
                    if (queryTokens.includes(tag.toLowerCase())) score += 2;
                }
                if (score > 0) {
                    results.push({ text: note, tags: t.tags, source: t.slug, score });
                }
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit).map(({ text, tags, source }) => ({ text, tags, source }));
    }

    /** 列出所有已初始化主题的 slug */
    topicSlugs(): string[] {
        return this.loadIndex().map((t) => t.slug);
    }
}
