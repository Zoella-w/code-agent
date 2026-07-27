import { prisma } from "@/lib/prisma";

export type EvalLabel = "accurate" | "inaccurate" | "partial";

export interface EvalSample {
    id: string;
    reviewOutput: string;
    verifyOutput?: string;
    label: EvalLabel;
    comment?: string;
    timestamp: string;
    superseded?: boolean;
}

/** 保存一条新标注样本 */
export async function addSample(sample: Omit<EvalSample, "id" | "timestamp">): Promise<EvalSample> {
    const record = await prisma.evaluation.create({
        data: {
            reviewOutput: sample.reviewOutput,
            verifyOutput: sample.verifyOutput,
            label: sample.label,
            comment: sample.comment,
        },
    });
    return {
        id: record.id,
        reviewOutput: record.reviewOutput,
        verifyOutput: record.verifyOutput ?? undefined,
        label: record.label as EvalLabel,
        comment: record.comment ?? undefined,
        timestamp: record.timestamp.toISOString(),
        superseded: record.superseded,
    };
}

/** 获取所有标注样本，最新的在前 */
export async function listSamples(): Promise<EvalSample[]> {
    const records = await prisma.evaluation.findMany({
        orderBy: { timestamp: "desc" },
    });
    return records.map((r) => ({
        ...r,
        label: r.label as EvalLabel,
        timestamp: r.timestamp.toISOString(),
        verifyOutput: r.verifyOutput ?? undefined,
        comment: r.comment ?? undefined,
    }));
}

/** 将指定样本标记为已覆盖（重新标注时调用） */
export async function markSuperseded(id: string): Promise<boolean> {
    try {
        await prisma.evaluation.update({
            where: { id },
            data: { superseded: true },
        });
        return true;
    } catch {
        return false;
    }
}
