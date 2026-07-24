export function getRecord(state, id) {
  return state.questions[id] || {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    lastAnsweredAt: null,
    lastChoice: null,
    favorite: false,
    later: false
  };
}

export function getOverallStats(problems, state) {
  const records = problems.map(problem => getRecord(state, problem.id));
  const totalAttempts = records.reduce((sum, record) => sum + record.attempts, 0);
  const totalCorrect = records.reduce((sum, record) => sum + record.correct, 0);
  const answered = records.filter(record => record.attempts > 0).length;
  return {
    total: problems.length,
    answered,
    unanswered: problems.length - answered,
    totalAttempts,
    totalCorrect,
    accuracy: totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    everWrong: records.filter(record => record.incorrect > 0).length,
    currentStreak: state.streak.current,
    bestStreak: state.streak.best,
    needsReview: problems.filter(problem => problem.needsReview).length
  };
}

export function getTopicStats(problems, state) {
  const grouped = new Map();
  for (const problem of problems) {
    if (!grouped.has(problem.topic)) grouped.set(problem.topic, []);
    grouped.get(problem.topic).push(problem);
  }
  return [...grouped.entries()]
    .map(([topic, topicProblems]) => {
      const records = topicProblems.map(problem => getRecord(state, problem.id));
      const attempts = records.reduce((sum, record) => sum + record.attempts, 0);
      const correct = records.reduce((sum, record) => sum + record.correct, 0);
      const answered = records.filter(record => record.attempts > 0).length;
      return {
        topic,
        total: topicProblems.length,
        answered,
        unanswered: topicProblems.length - answered,
        accuracy: attempts ? Math.round((correct / attempts) * 100) : 0
      };
    })
    .sort((a, b) => a.topic.localeCompare(b.topic, "ja"));
}

export function getRankings(problems, state) {
  const attempted = problems
    .map(problem => ({ problem, record: getRecord(state, problem.id) }))
    .filter(item => item.record.attempts > 0);
  const recentWrong = attempted
    .filter(item => item.record.incorrect > 0)
    .sort((a, b) => Date.parse(b.record.lastAnsweredAt || 0) - Date.parse(a.record.lastAnsweredAt || 0))
    .slice(0, 5);
  const mostWrong = attempted
    .filter(item => item.record.incorrect > 0)
    .sort((a, b) => b.record.incorrect - a.record.incorrect || b.record.attempts - a.record.attempts)
    .slice(0, 5);
  const lowAccuracy = attempted
    .sort((a, b) => (a.record.correct / a.record.attempts) - (b.record.correct / b.record.attempts))
    .slice(0, 5);
  return { recentWrong, mostWrong, lowAccuracy };
}
