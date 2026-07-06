/** 评估 Faithfulness：答案中有多少断言能被检索文档支撑，0~1 */
export async function evaluateFaithfulness(
    answer: string,
    contexts: string[], // 检索到的文档内容
    chatModel: (prompt: string) => Promise<string>
): Promise<{ score: number; breakdown: string }> {
    // 用 LLM 把答案拆成独立的断言
    const claimsPrompt = `请将以下答案拆解为独立的陈述断言，每行一条，只保留可验证的事实性陈述：
  答案：${answer}
  断言列表（每行一条）：`;
    const claimsText = await chatModel(claimsPrompt);
    const claims = claimsText
        .split("\n")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

    // 逐条验证
    const contextText = contexts.join("\n\n");
    let supported = 0;
    const results: string[] = [];
    for (const claim of claims) {
        const verifyPrompt = `请判断以下断言是否可以从参考文档中得到支撑。仅回答 YES 或 NO。
  参考文档：
  ${contextText}
  断言：${claim}
  该断言是否被文档支撑？（YES/NO）：`;
        const verdict = await chatModel(verifyPrompt);
        const isSupported = verdict.trim().toUpperCase().startsWith("YES");
        if (isSupported) supported++;
        results.push(`${isSupported ? "✅" : "❌"} ${claim}`);
    }

    return {
        score: supported / claims.length,
        breakdown: results.join("\n"),
    };
}

/** 评估 Answer Relevancy：答案是否切中用户问题，0~1 */
export async function evaluateAnswerRelevancy(
    question: string,
    answer: string,
    chatModel: (prompt: string) => Promise<string>
): Promise<{ score: number; breakdown: string }> {
    // 让 LLM 根据答案反向生成 3 个问题
    const genPrompt = `根据以下答案，生成 3 个该答案能回答的问题，每行一个：
  答案：${answer}
  问题（每行一个）：`;
    const genText = await chatModel(genPrompt);
    const generatedQuestions = genText
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

    // 对每个反向生成的问题，判断它和原问题的相似度
    let totalSimilarity = 0;
    for (const gq of generatedQuestions) {
        const judgePrompt = `请判断以下两个问题是否在问同一件事。给出 0 到 1 的分数。
  问题 A：${question}
  问题 B：${gq}
  分数（0-1）：`;
        const scoreText = await chatModel(judgePrompt);
        const score = parseFloat(scoreText.trim()) || 0;
        totalSimilarity += score;
    }
    const avgSimilarity = generatedQuestions.length > 0
        ? totalSimilarity / generatedQuestions.length
        : 0;

    return {
        score: avgSimilarity,
        breakdown: `原始问题：${question}\n反向问题得分：${avgSimilarity.toFixed(2)}`,
    };
}