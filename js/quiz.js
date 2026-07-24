export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createSession(problemIds, mode) {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
    problemIds: [...problemIds],
    index: 0,
    results: {},
    selectedChoice: null,
    revealed: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "active"
  };
}

export function getDurationSeconds(session) {
  const start = Date.parse(session?.startedAt);
  const end = Date.parse(session?.completedAt || new Date().toISOString());
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}分${String(seconds).padStart(2, "0")}秒` : `${seconds}秒`;
}

export function sessionSummary(session) {
  const results = Object.values(session?.results || {});
  const correct = results.filter(result => result.correct).length;
  const total = session?.problemIds?.length || 0;
  return {
    total,
    answered: results.length,
    correct,
    incorrect: results.length - correct,
    rate: results.length ? Math.round((correct / results.length) * 100) : 0
  };
}
