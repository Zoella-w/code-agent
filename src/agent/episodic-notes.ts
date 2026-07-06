/** 情景笔记上限（参考 pico EPISODIC_NOTE_LIMIT = 12） */
const EPISODIC_NOTE_LIMIT = 12;

/** 单条情景笔记 */
export interface EpisodicNote {
    text: string;
    tags: string[];
    source: string;
    createdAt: string;
    noteIndex: number;
}

/** 文本分词：提取字母数字下划线 → 小写集合 */
function tokenize(text: string): Set<string> {
    const tokens = text.toLowerCase().match(/[a-z0-9_一-鿿]+/g);
    return new Set(tokens ?? []);
}

/** 去重并保持顺序 */
function dedupe<T>(items: T[]): T[] {
    const seen = new Set<T>();
    return items.filter((item) => {
        if (seen.has(item)) return false;
        seen.add(item);
        return true;
    });
}

/** 情景笔记存储：内存 + 关键词检索（参考 pico episodic_notes） */
export class EpisodicMemoryStore {
    private notes: EpisodicNote[] = [];
    private counter = 0;

    /** 追加一条笔记，自动去重和裁剪上限 */
    appendNote(text: string, tags: string[] = [], source: string = ""): EpisodicNote {
        const clipped = text.length > 500 ? text.slice(0, 500) : text.trim();
        if (!clipped) return null!;

        const normalizedTags = dedupe(tags.filter((t) => t.trim()).map((t) => t.trim()));
        const note: EpisodicNote = {
            text: clipped,
            tags: normalizedTags,
            source,
            createdAt: new Date().toISOString(),
            noteIndex: this.counter++,
        };

        // 同文本去重：移除旧版保留新版
        this.notes = this.notes.filter((n) => n.text !== clipped);
        this.notes.push(note);
        // 保持最新 12 条
        if (this.notes.length > EPISODIC_NOTE_LIMIT) {
            this.notes = this.notes.slice(-EPISODIC_NOTE_LIMIT);
        }
        return note;
    }

    /** 关键词检索：tag 精确命中 > 关键词重叠 > 时间新旧 */
    retrievalCandidates(query: string, limit: number = 3): EpisodicNote[] {
        const queryTokens = tokenize(query);
        const ranked: { note: EpisodicNote; score: [number, number, number] }[] = [];

        for (const note of this.notes) {
            const noteTags = new Set(note.tags.map((t) => t.toLowerCase()));
            const noteTokens = new Set([...tokenize(note.text), ...tokenize(note.source), ...noteTags]);
            const exactTagMatch = [...queryTokens].some((t) => noteTags.has(t)) ? 1 : 0;
            const keywordOverlap = [...queryTokens].filter((t) => noteTokens.has(t)).length;
            if (exactTagMatch === 0 && keywordOverlap === 0) continue;
            const recency = new Date(note.createdAt).getTime();
            ranked.push({ note, score: [exactTagMatch, keywordOverlap, recency] });
        }

        ranked.sort((a, b) => {
            const [a1, a2, a3] = a.score;
            const [b1, b2, b3] = b.score;
            if (b1 !== a1) return b1 - a1;
            if (b2 !== a2) return b2 - a2;
            return b3 - a3;
        });
        return ranked.slice(0, limit).map((r) => r.note);
    }

    getAll(): EpisodicNote[] {
        return [...this.notes];
    }
}
