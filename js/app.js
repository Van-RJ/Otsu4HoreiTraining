import { problems as sourceProblems } from "../data/problems.js";
import {
  clearState,
  ensureQuestionRecord,
  exportState,
  importState,
  loadState,
  saveState
} from "./storage.js";
import { validateProblems } from "./validator.js";
import { createSession, formatDuration, getDurationSeconds, sessionSummary, shuffle } from "./quiz.js";
import { getOverallStats, getRankings, getRecord, getTopicStats } from "./progress.js";

const app = document.querySelector("#app");
const bottomNav = document.querySelector("#bottom-nav");
const saveStatus = document.querySelector("#save-status");
const toastElement = document.querySelector("#toast");
const validation = validateProblems(sourceProblems);
const problems = validation.valid;
const problemMap = new Map(problems.map(problem => [problem.id, problem]));
const validIds = problems.map(problem => problem.id);

let state = loadState(validIds);
let currentView = "home";
let toastTimer;

applyTheme();
renderHome();

function h(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "記録なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "記録なし";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function persist(message = "保存しました") {
  const saved = saveState(state, validIds);
  saveStatus.textContent = saved ? "保存済み" : "保存できませんでした";
  if (message) showToast(saved ? message : "保存できませんでした");
}

function showToast(message) {
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.hidden = false;
  toastTimer = setTimeout(() => {
    toastElement.hidden = true;
  }, 2200);
}

function setView(view) {
  currentView = view;
  bottomNav.querySelectorAll("button").forEach(button => {
    const active = button.dataset.action === view;
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.settings.theme === "dark" ? "#0f1822" : "#eaf3fb";
}

function statCard(label, value) {
  return `<div class="stat"><span class="stat-value">${h(value)}</span><span class="stat-label">${h(label)}</span></div>`;
}

function renderHome() {
  setView("home");
  const stats = getOverallStats(problems, state);
  const activeSession = state.session?.status === "active" ? state.session : null;
  const filterCounts = {
    unanswered: problems.filter(problem => getRecord(state, problem.id).attempts === 0).length,
    wrong: problems.filter(problem => getRecord(state, problem.id).incorrect > 0).length,
    favorite: problems.filter(problem => getRecord(state, problem.id).favorite).length,
    later: problems.filter(problem => getRecord(state, problem.id).later).length
  };

  app.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">危険物取扱者 乙種第4類</p>
      <h1>法令を、少しずつ確実に。</h1>
      <p class="lead">全${stats.total}問。選んでから確定するので、落ち着いて考えられます。</p>
    </section>

    ${activeSession ? `
      <section class="card continue-card" aria-labelledby="continue-title">
        <span class="badge">前回の続き</span>
        <h2 id="continue-title" style="margin-top:10px">${h(activeSession.mode)}</h2>
        <p class="muted">${activeSession.index + 1}問目 / ${activeSession.problemIds.length}問 · 開始 ${h(formatDate(activeSession.startedAt))}</p>
        <button class="button primary block" type="button" data-action="resume">学習を再開する</button>
      </section>
    ` : ""}

    <section class="card hero-card" aria-labelledby="overview-title">
      <h2 id="overview-title" style="margin-top:0">学習状況</h2>
      <div class="stats-grid">
        ${statCard("全問題", stats.total)}
        ${statCard("解答済み", stats.answered)}
        ${statCard("未回答", stats.unanswered)}
        ${statCard("累計回答", stats.totalAttempts)}
        ${statCard("累計正解", stats.totalCorrect)}
        ${statCard("正答率", `${stats.accuracy}%`)}
        ${statCard("間違い経験", stats.everWrong)}
        ${statCard("連続正解", stats.currentStreak)}
        ${statCard("最高連続", stats.bestStreak)}
        ${statCard("要確認", stats.needsReview)}
      </div>
    </section>

    <h2>問題を始める</h2>
    <section class="action-grid" aria-label="出題方法">
      ${actionCard("全問題", "59問を順番に", stats.total, "all", true)}
      ${actionCard("ランダム10問", "短時間の復習", 10, "random10")}
      ${actionCard("ランダム20問", "しっかり演習", 20, "random20")}
      ${actionCard("未回答", "まだ解いていない", filterCounts.unanswered, "unanswered")}
      ${actionCard("間違えた問題", "一度でも不正解", filterCounts.wrong, "wrong")}
      ${actionCard("お気に入り", "★を付けた問題", filterCounts.favorite, "favorite")}
      ${actionCard("あとで解く", "しおりを付けた問題", filterCounts.later, "later")}
      <button class="action-card" type="button" data-action="topics">
        <span><strong>分野別</strong><small>テーマを選んで演習</small></span>
        <span class="count-badge">${getTopicStats(problems, state).length}</span>
      </button>
      <button class="action-card" type="button" data-action="progress">
        <span><strong>進捗</strong><small>苦手分野を確認</small></span>
        <span aria-hidden="true">→</span>
      </button>
      <button class="action-card" type="button" data-action="settings">
        <span><strong>設定</strong><small>表示・データ管理</small></span>
        <span aria-hidden="true">→</span>
      </button>
    </section>
  `;
  app.focus({ preventScroll: true });
}

function actionCard(title, subtitle, count, mode, primary = false) {
  return `
    <button class="action-card ${primary ? "primary" : ""}" type="button" data-action="start" data-mode="${h(mode)}">
      <span><strong>${h(title)}</strong><small>${h(subtitle)}</small></span>
      <span class="count-badge">${h(count)}</span>
    </button>
  `;
}

function idsForMode(mode) {
  switch (mode) {
    case "all":
      return { ids: problems.map(problem => problem.id), label: "全問題" };
    case "random10":
      return { ids: shuffle(problems).slice(0, 10).map(problem => problem.id), label: "ランダム10問" };
    case "random20":
      return { ids: shuffle(problems).slice(0, 20).map(problem => problem.id), label: "ランダム20問" };
    case "unanswered":
      return {
        ids: problems.filter(problem => getRecord(state, problem.id).attempts === 0).map(problem => problem.id),
        label: "未回答"
      };
    case "wrong":
      return {
        ids: problems.filter(problem => getRecord(state, problem.id).incorrect > 0).map(problem => problem.id),
        label: "間違えた問題"
      };
    case "favorite":
      return {
        ids: problems.filter(problem => getRecord(state, problem.id).favorite).map(problem => problem.id),
        label: "お気に入り"
      };
    case "later":
      return {
        ids: problems.filter(problem => getRecord(state, problem.id).later).map(problem => problem.id),
        label: "あとで解く"
      };
    default:
      return { ids: [], label: "問題演習" };
  }
}

function startMode(mode) {
  const selection = idsForMode(mode);
  startIds(selection.ids, selection.label);
}

function startIds(ids, label) {
  const cleanIds = [...new Set(ids)].filter(id => problemMap.has(id));
  if (!cleanIds.length) {
    showToast("該当する問題はありません");
    return;
  }
  state.session = createSession(cleanIds, label);
  persist("学習を開始しました");
  renderQuiz();
}

function renderTopics() {
  setView("topics");
  const topics = getTopicStats(problems, state);
  app.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">TOPICS</p>
      <h1>分野別</h1>
      <p class="lead">学びたい分野を選ぶと、その分野の全問題を出題します。</p>
    </section>
    <ul class="topic-list">
      ${topics.map(item => `
        <li>
          <button class="topic-button" type="button" data-action="start-topic" data-topic="${h(item.topic)}">
            <span>
              <strong>${h(item.topic)}</strong>
              <span class="meta">解答済み ${item.answered}/${item.total} · 正答率 ${item.accuracy}%</span>
            </span>
            <span class="count-badge">${item.total}問</span>
          </button>
        </li>
      `).join("")}
    </ul>
  `;
  app.focus({ preventScroll: true });
}

function renderQuiz() {
  const session = state.session;
  if (!session || session.status !== "active") {
    renderHome();
    return;
  }
  setView("quiz");
  const problemId = session.problemIds[session.index];
  const problem = problemMap.get(problemId);
  if (!problem) {
    session.index += 1;
    persist("");
    if (session.index >= session.problemIds.length) finishSession();
    else renderQuiz();
    return;
  }
  const record = getRecord(state, problem.id);
  const result = session.results[problem.id];
  const revealed = session.revealed && result;
  const progress = ((session.index + (revealed ? 1 : 0)) / session.problemIds.length) * 100;

  app.innerHTML = `
    <div class="quiz-top">
      <div>
        <span class="quiz-count">${session.index + 1} / ${session.problemIds.length}</span>
        <span class="meta">　${h(session.mode)}</span>
      </div>
      <button class="button" type="button" data-action="interrupt">中断</button>
    </div>
    <div class="progress-track" role="progressbar" aria-label="今回の進捗" aria-valuemin="0" aria-valuemax="${session.problemIds.length}" aria-valuenow="${session.index + (revealed ? 1 : 0)}">
      <div class="progress-fill" style="width:${progress}%"></div>
    </div>

    <article class="card question-card" aria-labelledby="question-title">
      <div class="question-meta">
        <span class="badge">${h(problem.topic)}</span>
        ${problem.needsReview ? '<span class="badge warning">要確認</span>' : ""}
        <span class="meta">${h(problem.sourceImage)}・問${h(problem.sourceQuestionNumber)}</span>
      </div>
      <h1 id="question-title" class="question-text">${h(problem.question)}</h1>
      <fieldset class="choice-list" aria-label="選択肢" ${revealed ? "disabled" : ""}>
        ${problem.choices.map((choice, index) => renderChoice(problem, index + 1, choice.text, result, revealed)).join("")}
      </fieldset>

      <div class="quiz-tools" aria-label="問題の管理">
        <button class="icon-button ${record.favorite ? "active" : ""}" type="button" data-action="toggle-favorite" aria-pressed="${record.favorite}">
          <span aria-hidden="true">${record.favorite ? "★" : "☆"}</span> お気に入り
        </button>
        <button class="icon-button ${record.later ? "active" : ""}" type="button" data-action="toggle-later" aria-pressed="${record.later}">
          <span aria-hidden="true">▮</span> あとで解く
        </button>
      </div>

      ${revealed ? renderFeedback(problem, result) : ""}
    </article>

    <div class="quiz-footer">
      ${revealed
        ? `<button class="button primary block" type="button" data-action="next">${session.index + 1 === session.problemIds.length ? "結果を見る" : "次へ"}</button>`
        : `<button class="button primary block" type="button" data-action="answer" ${session.selectedChoice ? "" : "disabled"}>回答する</button>`
      }
    </div>
  `;
  app.focus({ preventScroll: true });
}

function renderChoice(problem, choiceNumber, text, result, revealed) {
  const selected = state.session.selectedChoice === choiceNumber;
  let className = selected ? " selected" : "";
  let mark = "";
  if (revealed && choiceNumber === problem.correctChoice) {
    className += " correct";
    mark = '<span class="choice-mark" aria-label="正答">✓</span>';
  } else if (revealed && choiceNumber === result.choice && !result.correct) {
    className += " incorrect";
    mark = '<span class="choice-mark" aria-label="あなたの誤答">✕</span>';
  }
  return `
    <label class="choice${className}">
      <input type="radio" name="choice" value="${choiceNumber}" ${selected ? "checked" : ""}>
      <span class="choice-number">${choiceNumber}</span>
      <span>${h(text)}</span>
      ${mark}
    </label>
  `;
}

function renderFeedback(problem, result) {
  const memory = typeof problem.memoryTip === "string" ? problem.memoryTip.trim() : "";
  const review = typeof problem.reviewNotes === "string" ? problem.reviewNotes.trim() : "";
  return `
    <section class="feedback" aria-live="polite" aria-labelledby="feedback-title">
      <p id="feedback-title" class="feedback-title ${result.correct ? "success" : "danger"}">
        <span aria-hidden="true">${result.correct ? "✓" : "✕"}</span>
        ${result.correct ? "正解" : "不正解"}
      </p>
      <div class="answer-summary">
        <span><strong>自分の回答:</strong> ${result.choice}. ${h(problem.choices[result.choice - 1].text)}</span>
        <span><strong>正答:</strong> ${problem.correctChoice}. ${h(problem.choices[problem.correctChoice - 1].text)}</span>
      </div>
      <div class="explanation-block">
        <h3>解説</h3>
        <p>${h(problem.explanation)}</p>
      </div>
      ${memory ? `
        <div class="explanation-block">
          <h3>覚え方</h3>
          <p>${h(memory)}</p>
        </div>
      ` : ""}
      ${problem.needsReview ? `
        <div class="explanation-block review-note">
          <h3>要確認メモ</h3>
          <p>${h(review || "元の解答表がないため、正答・解説の照合を推奨します。")}</p>
        </div>
      ` : ""}
      <div class="button-row" style="margin-top:14px">
        <button class="button" type="button" data-action="retry-current">もう一度</button>
      </div>
    </section>
  `;
}

function selectChoice(choice) {
  const session = state.session;
  if (!session || session.revealed || !Number.isInteger(choice) || choice < 1 || choice > 5) return;
  session.selectedChoice = choice;
  persist("");
  if (state.settings.confirmBeforeAnswer) {
    renderQuiz();
  } else {
    submitAnswer();
  }
}

function submitAnswer() {
  const session = state.session;
  if (!session || session.revealed || !session.selectedChoice) return;
  const problem = problemMap.get(session.problemIds[session.index]);
  if (!problem) return;
  const choice = session.selectedChoice;
  const correct = choice === problem.correctChoice;
  const record = ensureQuestionRecord(state, problem.id);
  record.attempts += 1;
  record.correct += correct ? 1 : 0;
  record.incorrect += correct ? 0 : 1;
  record.lastAnsweredAt = new Date().toISOString();
  record.lastChoice = choice;
  if (correct) {
    state.streak.current += 1;
    state.streak.best = Math.max(state.streak.best, state.streak.current);
  } else {
    state.streak.current = 0;
  }
  session.results[problem.id] = { choice, correct };
  session.revealed = true;
  persist(correct ? "正解です" : "不正解です");
  renderQuiz();
}

function retryCurrent() {
  const session = state.session;
  if (!session) return;
  session.selectedChoice = null;
  session.revealed = false;
  delete session.results[session.problemIds[session.index]];
  persist("");
  renderQuiz();
}

function nextQuestion() {
  const session = state.session;
  if (!session?.revealed) return;
  if (session.index + 1 >= session.problemIds.length) {
    finishSession();
    return;
  }
  session.index += 1;
  session.selectedChoice = null;
  session.revealed = false;
  persist("");
  renderQuiz();
}

function finishSession() {
  if (!state.session) return;
  state.session.status = "complete";
  state.session.completedAt = new Date().toISOString();
  state.session.selectedChoice = null;
  state.session.revealed = false;
  persist("今回の結果を保存しました");
  renderResult();
}

function renderResult() {
  const session = state.session;
  if (!session || session.status !== "complete") {
    renderHome();
    return;
  }
  setView("result");
  const summary = sessionSummary(session);
  const wrongIds = session.problemIds.filter(id => session.results[id] && !session.results[id].correct);
  app.innerHTML = `
    <section class="page-head result-hero">
      <p class="eyebrow">RESULT</p>
      <h1>${h(session.mode)}の結果</h1>
      <p class="result-score">${summary.rate}<small>%</small></p>
      <p class="muted">${summary.correct}問正解 / ${summary.total}問</p>
    </section>
    <section class="stats-grid result-grid" aria-label="今回の集計">
      ${statCard("問題数", summary.total)}
      ${statCard("正解", summary.correct)}
      ${statCard("不正解", summary.incorrect)}
      ${statCard("正答率", `${summary.rate}%`)}
      ${statCard("所要時間", formatDuration(getDurationSeconds(session)))}
    </section>

    <h2>間違えた問題</h2>
    ${wrongIds.length ? `
      <ul class="wrong-list">
        ${wrongIds.map(id => {
          const problem = problemMap.get(id);
          const result = session.results[id];
          return `
            <li class="rank-item">
              <strong>${h(problem.question)}</strong>
              <span class="meta">${h(problem.topic)} · あなたの回答 ${result.choice} / 正答 ${problem.correctChoice}</span>
            </li>
          `;
        }).join("")}
      </ul>
    ` : '<div class="empty">全問正解です。すばらしい結果です。</div>'}

    <div class="button-row" style="margin-top:22px">
      <button class="button primary" type="button" data-action="retry-wrong" ${wrongIds.length ? "" : "disabled"}>間違いだけ再挑戦</button>
      <button class="button" type="button" data-action="retry-set">同じセットを再挑戦</button>
      <button class="button" type="button" data-action="home">ホーム</button>
    </div>
  `;
  app.focus({ preventScroll: true });
}

function renderProgress() {
  setView("progress");
  const stats = getOverallStats(problems, state);
  const topics = getTopicStats(problems, state);
  const rankings = getRankings(problems, state);
  app.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">PROGRESS</p>
      <h1>学習の進捗</h1>
      <p class="lead">正答率は、各問題に答えたすべての回数をもとに計算しています。</p>
    </section>
    <section class="card hero-card">
      <div class="stats-grid">
        ${statCard("解答済み", `${stats.answered}/${stats.total}`)}
        ${statCard("累計回答", stats.totalAttempts)}
        ${statCard("正答率", `${stats.accuracy}%`)}
        ${statCard("連続正解", stats.currentStreak)}
        ${statCard("最高連続", stats.bestStreak)}
      </div>
    </section>

    <h2>分野別</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>分野</th><th>問題</th><th>解答済み</th><th>未回答</th><th>正答率</th></tr></thead>
        <tbody>
          ${topics.map(item => `
            <tr>
              <td>${h(item.topic)}</td>
              <td>${item.total}</td>
              <td>${item.answered}</td>
              <td>${item.unanswered}</td>
              <td>${item.accuracy}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    ${rankingSection("最近間違えた問題", rankings.recentWrong, "recent")}
    ${rankingSection("間違い回数が多い問題", rankings.mostWrong, "wrong")}
    ${rankingSection("正答率が低い問題", rankings.lowAccuracy, "accuracy")}

    <h2>要確認問題 <span class="badge warning">${validation.needsReview.length}問</span></h2>
    ${validation.needsReview.length ? `
      <ul class="rank-list">
        ${validation.needsReview.map(problem => `
          <li class="rank-item">
            <strong>${h(problem.sourceImage)}・問${h(problem.sourceQuestionNumber)}　${h(problem.topic)}</strong>
            <span>${h(problem.question)}</span>
            <span class="meta">${h(problem.reviewNotes || "元の解答表がないため照合推奨")}</span>
          </li>
        `).join("")}
      </ul>
    ` : '<div class="empty">要確認問題はありません。</div>'}
  `;
  app.focus({ preventScroll: true });
}

function rankingSection(title, items, type) {
  return `
    <h2>${h(title)}</h2>
    ${items.length ? `
      <ul class="rank-list">
        ${items.map(({ problem, record }) => {
          const rate = record.attempts ? Math.round((record.correct / record.attempts) * 100) : 0;
          const meta = type === "recent"
            ? `${formatDate(record.lastAnsweredAt)} · 不正解 ${record.incorrect}回`
            : type === "wrong"
              ? `不正解 ${record.incorrect}回 / ${record.attempts}回答`
              : `正答率 ${rate}% / ${record.attempts}回答`;
          return `
            <li class="rank-item">
              <strong>${h(problem.question)}</strong>
              <span class="meta">${h(problem.topic)} · ${h(meta)}</span>
            </li>
          `;
        }).join("")}
      </ul>
    ` : '<div class="empty">学習履歴がたまると、ここに表示されます。</div>'}
  `;
}

function renderSettings() {
  setView("settings");
  app.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">SETTINGS</p>
      <h1>設定</h1>
      <p class="lead">表示方法と、この端末に保存された学習履歴を管理します。</p>
    </section>

    <section class="card settings-list">
      <div class="setting-row">
        <div>
          <label for="theme-select">表示テーマ</label>
          <div class="meta">ライト・ダーク・端末設定</div>
        </div>
        <select id="theme-select">
          <option value="system" ${state.settings.theme === "system" ? "selected" : ""}>端末設定</option>
          <option value="light" ${state.settings.theme === "light" ? "selected" : ""}>ライト</option>
          <option value="dark" ${state.settings.theme === "dark" ? "selected" : ""}>ダーク</option>
        </select>
      </div>
      <div class="setting-row">
        <div>
          <label for="confirm-toggle">回答前に確認する</label>
          <div class="meta">オフでは選択肢タップで即時確定</div>
        </div>
        <label class="switch">
          <input id="confirm-toggle" type="checkbox" ${state.settings.confirmBeforeAnswer ? "checked" : ""}>
          <span aria-hidden="true"></span>
        </label>
      </div>
    </section>

    <h2>データ管理</h2>
    <section class="card">
      <p class="muted">履歴のバックアップや別ブラウザへの移行にはJSONファイルを使います。</p>
      <div class="button-row">
        <button class="button" type="button" data-action="export">履歴をエクスポート</button>
        <button class="button" type="button" data-action="choose-import">履歴をインポート</button>
        <input id="import-file" type="file" accept="application/json,.json" hidden>
        <button class="button danger" type="button" data-action="clear">履歴を全削除</button>
      </div>
    </section>

    <h2>問題データ検証</h2>
    <section class="card">
      <p class="${validation.invalid.length ? "validation-error" : "validation-ok"}">
        ${validation.invalid.length
          ? `✕ ${validation.invalid.length}問を通常出題から除外しています`
          : `✓ 全${sourceProblems.length}問が検証を通過しました`}
      </p>
      <p class="muted">ID重複、問題文、5選択肢、正答番号、法令カテゴリ、図の有無を起動時に検証しています。</p>
      ${validation.invalid.length ? `
        <ul>
          ${validation.invalid.map(item => `<li><strong>${h(item.id)}</strong>: ${h(item.reasons.join("、"))}</li>`).join("")}
        </ul>
      ` : ""}
      <p><span class="badge warning">要確認 ${validation.needsReview.length}問</span></p>
      <ul>
        ${validation.needsReview.map(problem => `<li>${h(problem.id)} — ${h(problem.topic)}</li>`).join("")}
      </ul>
    </section>
  `;
  app.focus({ preventScroll: true });
}

function toggleFlag(flag) {
  const session = state.session;
  if (!session) return;
  const id = session.problemIds[session.index];
  const record = ensureQuestionRecord(state, id);
  record[flag] = !record[flag];
  persist(flag === "favorite"
    ? (record[flag] ? "お気に入りに追加しました" : "お気に入りから外しました")
    : (record[flag] ? "あとで解くに追加しました" : "あとで解くから外しました"));
  renderQuiz();
}

function exportHistory() {
  try {
    const blob = new Blob([exportState(state, validIds)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `otsu4-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("履歴を書き出しました");
  } catch (error) {
    console.error(error);
    showToast("エクスポートできませんでした");
  }
}

async function importHistory(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const imported = importState(text, validIds);
    if (!window.confirm("現在の学習履歴を、選択したファイルの内容で置き換えますか？")) return;
    state = imported;
    persist("履歴をインポートしました");
    applyTheme();
    renderSettings();
  } catch (error) {
    console.error(error);
    showToast(error.message || "インポートできませんでした");
  }
}

app.addEventListener("change", event => {
  if (event.target.matches('input[name="choice"]')) {
    selectChoice(Number(event.target.value));
  } else if (event.target.id === "theme-select") {
    state.settings.theme = event.target.value;
    applyTheme();
    persist("テーマを変更しました");
  } else if (event.target.id === "confirm-toggle") {
    state.settings.confirmBeforeAnswer = event.target.checked;
    persist("回答方法を変更しました");
  } else if (event.target.id === "import-file") {
    importHistory(event.target.files?.[0]);
    event.target.value = "";
  }
});

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  switch (action) {
    case "home":
      renderHome();
      break;
    case "progress":
      renderProgress();
      break;
    case "settings":
      renderSettings();
      break;
    case "topics":
      renderTopics();
      break;
    case "start":
      startMode(button.dataset.mode);
      break;
    case "start-topic": {
      const topic = button.dataset.topic;
      const ids = problems.filter(problem => problem.topic === topic).map(problem => problem.id);
      startIds(ids, topic);
      break;
    }
    case "resume":
      renderQuiz();
      break;
    case "interrupt":
      persist("中断位置を保存しました");
      renderHome();
      break;
    case "answer":
      submitAnswer();
      break;
    case "next":
      nextQuestion();
      break;
    case "retry-current":
      retryCurrent();
      break;
    case "toggle-favorite":
      toggleFlag("favorite");
      break;
    case "toggle-later":
      toggleFlag("later");
      break;
    case "retry-wrong": {
      const wrongIds = state.session.problemIds.filter(id => state.session.results[id] && !state.session.results[id].correct);
      startIds(wrongIds, "間違いだけ再挑戦");
      break;
    }
    case "retry-set":
      startIds(state.session.problemIds, `${state.session.mode}・再挑戦`);
      break;
    case "export":
      exportHistory();
      break;
    case "choose-import":
      document.querySelector("#import-file")?.click();
      break;
    case "clear":
      if (window.confirm("学習履歴・お気に入り・設定・中断中セッションをすべて削除します。元に戻せません。削除しますか？")) {
        state = clearState();
        applyTheme();
        persist("すべての履歴を削除しました");
        renderSettings();
      }
      break;
    default:
      break;
  }
});

document.addEventListener("keydown", event => {
  if (currentView !== "quiz") return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (/^[1-5]$/.test(event.key) && !state.session?.revealed) {
    event.preventDefault();
    selectChoice(Number(event.key));
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (state.session?.revealed) nextQuestion();
    else submitAnswer();
  } else if (event.key === "Escape") {
    event.preventDefault();
    persist("中断位置を保存しました");
    renderHome();
  }
});

window.addEventListener("storage", event => {
  if (event.key !== "otsu4-law-trainer") return;
  state = loadState(validIds);
  applyTheme();
  if (currentView === "quiz" && state.session?.status === "active") renderQuiz();
  else if (currentView === "progress") renderProgress();
  else if (currentView === "settings") renderSettings();
  else renderHome();
  showToast("別タブの学習履歴を反映しました");
});
