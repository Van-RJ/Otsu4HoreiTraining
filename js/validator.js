const LAW_CATEGORY = "危険物に関する法令";

export function validateProblems(problems) {
  const seenIds = new Set();
  const valid = [];
  const invalid = [];

  if (!Array.isArray(problems)) {
    return { valid, invalid: [{ id: "(データ全体)", reasons: ["配列ではありません"] }], needsReview: [] };
  }

  for (const problem of problems) {
    const reasons = [];
    const id = typeof problem?.id === "string" && problem.id.trim() ? problem.id : "(IDなし)";

    if (id === "(IDなし)") reasons.push("idが空です");
    if (seenIds.has(id)) reasons.push("idが重複しています");
    seenIds.add(id);

    if (typeof problem?.question !== "string" || !problem.question.trim()) {
      reasons.push("questionが空です");
    }
    if (!Array.isArray(problem?.choices) || problem.choices.length !== 5) {
      reasons.push("choicesが5件ではありません");
    } else if (problem.choices.some(choice => typeof choice?.text !== "string" || !choice.text.trim())) {
      reasons.push("空の選択肢があります");
    }
    if (!Number.isInteger(problem?.correctChoice) || problem.correctChoice < 1 || problem.correctChoice > 5) {
      reasons.push("correctChoiceが1〜5の整数ではありません");
    }
    if (problem?.category !== LAW_CATEGORY) {
      reasons.push(`categoryが「${LAW_CATEGORY}」ではありません（物理・化学問題の可能性）`);
    }
    if (problem?.hasFigure === true) {
      reasons.push("図を必要とする問題です");
    }

    if (reasons.length) {
      invalid.push({ id, reasons });
      console.error(`[問題データ除外] ${id}: ${reasons.join("、")}`);
    } else {
      valid.push(problem);
    }
  }

  return {
    valid,
    invalid,
    needsReview: valid.filter(problem => problem.needsReview === true)
  };
}
