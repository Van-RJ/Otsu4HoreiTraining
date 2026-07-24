export const STORAGE_KEY = "otsu4-law-trainer";
export const STORAGE_VERSION = 1;

const defaultState = () => ({
  version: STORAGE_VERSION,
  questions: {},
  streak: { current: 0, best: 0 },
  settings: {
    theme: "system",
    confirmBeforeAnswer: true
  },
  session: null
});

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const safeInt = value => Number.isInteger(value) && value >= 0 ? value : 0;
const safeDate = value => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;

function sanitizeQuestionRecord(value) {
  if (!isObject(value)) return null;
  const attempts = safeInt(value.attempts);
  const correct = Math.min(safeInt(value.correct), attempts);
  const incorrect = Math.min(safeInt(value.incorrect), attempts - correct);
  return {
    attempts,
    correct,
    incorrect,
    lastAnsweredAt: safeDate(value.lastAnsweredAt),
    lastChoice: Number.isInteger(value.lastChoice) && value.lastChoice >= 1 && value.lastChoice <= 5
      ? value.lastChoice
      : null,
    favorite: value.favorite === true,
    later: value.later === true
  };
}

function sanitizeSession(value, validIds) {
  if (!isObject(value) || !Array.isArray(value.problemIds)) return null;
  const problemIds = [...new Set(value.problemIds.filter(id => typeof id === "string" && validIds.has(id)))];
  if (!problemIds.length) return null;
  const index = Math.min(safeInt(value.index), problemIds.length - 1);
  const results = {};
  if (isObject(value.results)) {
    for (const [id, result] of Object.entries(value.results)) {
      if (!problemIds.includes(id) || !isObject(result)) continue;
      const choice = result.choice;
      if (!Number.isInteger(choice) || choice < 1 || choice > 5) continue;
      results[id] = { choice, correct: result.correct === true };
    }
  }
  return {
    id: typeof value.id === "string" ? value.id : `session-${Date.now()}`,
    mode: typeof value.mode === "string" ? value.mode.slice(0, 80) : "問題演習",
    problemIds,
    index,
    results,
    selectedChoice: Number.isInteger(value.selectedChoice) && value.selectedChoice >= 1 && value.selectedChoice <= 5
      ? value.selectedChoice
      : null,
    revealed: value.revealed === true,
    startedAt: safeDate(value.startedAt) || new Date().toISOString(),
    completedAt: safeDate(value.completedAt),
    status: value.status === "complete" ? "complete" : "active"
  };
}

export function sanitizeState(value, validProblemIds = []) {
  const clean = defaultState();
  if (!isObject(value) || value.version !== STORAGE_VERSION) return clean;
  const validIds = new Set(validProblemIds);
  if (isObject(value.questions)) {
    for (const [id, record] of Object.entries(value.questions)) {
      if (!validIds.has(id)) continue;
      const sanitized = sanitizeQuestionRecord(record);
      if (sanitized) clean.questions[id] = sanitized;
    }
  }
  if (isObject(value.streak)) {
    clean.streak.current = safeInt(value.streak.current);
    clean.streak.best = Math.max(safeInt(value.streak.best), clean.streak.current);
  }
  if (isObject(value.settings)) {
    clean.settings.theme = ["system", "light", "dark"].includes(value.settings.theme)
      ? value.settings.theme
      : "system";
    clean.settings.confirmBeforeAnswer = value.settings.confirmBeforeAnswer !== false;
  }
  clean.session = sanitizeSession(value.session, validIds);
  return clean;
}

export function loadState(validProblemIds) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return sanitizeState(JSON.parse(raw), validProblemIds);
  } catch (error) {
    console.warn("保存データを読み込めなかったため、初期状態で起動します。", error);
    return defaultState();
  }
}

export function saveState(state, validProblemIds) {
  try {
    const sanitized = sanitizeState(state, validProblemIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch (error) {
    console.error("学習履歴を保存できませんでした。", error);
    return false;
  }
}

export function exportState(state, validProblemIds) {
  const payload = {
    app: "乙4 法令トレーニング",
    exportedAt: new Date().toISOString(),
    data: sanitizeState(state, validProblemIds)
  };
  return JSON.stringify(payload, null, 2);
}

export function importState(jsonText, validProblemIds) {
  const parsed = JSON.parse(jsonText);
  const candidate = isObject(parsed) && isObject(parsed.data) ? parsed.data : parsed;
  if (!isObject(candidate) || candidate.version !== STORAGE_VERSION) {
    throw new Error(`対応していない保存データです（必要なバージョン: ${STORAGE_VERSION}）。`);
  }
  return sanitizeState(candidate, validProblemIds);
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("学習履歴を削除できませんでした。", error);
  }
  return defaultState();
}

export function ensureQuestionRecord(state, id) {
  if (!state.questions[id]) {
    state.questions[id] = {
      attempts: 0,
      correct: 0,
      incorrect: 0,
      lastAnsweredAt: null,
      lastChoice: null,
      favorite: false,
      later: false
    };
  }
  return state.questions[id];
}
