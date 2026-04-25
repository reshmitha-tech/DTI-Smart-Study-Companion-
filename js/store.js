/* ===================================================
   store.js — localStorage persistence layer
   =================================================== */

const Store = (() => {
  // ---------- helpers ----------
  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---------- Study Sessions ----------
  function getStudySessions() {
    return _get('scholarly_sessions', []);
  }
  function addStudySession(session) {
    // session: { id, subject, duration (min), mode, date (ISO), points }
    const sessions = getStudySessions();
    session.id = session.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    session.date = session.date || new Date().toISOString();
    sessions.unshift(session); // newest first
    if (sessions.length > 200) sessions.length = 200; // cap
    _set('scholarly_sessions', sessions);
    return session;
  }

  // ---------- Streak ----------
  function getStreak() {
    return _get('scholarly_streak', { count: 0, lastDate: null });
  }
  function updateStreak() {
    const streak = getStreak();
    const today = new Date().toDateString();
    if (streak.lastDate === today) return streak; // already counted today

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (streak.lastDate === yesterday) {
      streak.count += 1;
    } else if (streak.lastDate !== today) {
      streak.count = 1; // reset
    }
    streak.lastDate = today;
    _set('scholarly_streak', streak);
    return streak;
  }

  // ---------- Points ----------
  function getPoints() {
    return _get('scholarly_points', 0);
  }
  function addPoints(amount) {
    const pts = getPoints() + amount;
    _set('scholarly_points', pts);
    return pts;
  }

  // ---------- Daily Goal ----------
  function getDailyGoal() {
    return _get('scholarly_daily_goal', { target: 120, achieved: 0, date: new Date().toDateString() });
  }
  function updateDailyGoal(minutesStudied) {
    let goal = getDailyGoal();
    const today = new Date().toDateString();
    if (goal.date !== today) {
      goal = { target: goal.target, achieved: 0, date: today };
    }
    goal.achieved += minutesStudied;
    _set('scholarly_daily_goal', goal);
    return goal;
  }
  function setDailyGoalTarget(minutes) {
    const goal = getDailyGoal();
    goal.target = minutes;
    _set('scholarly_daily_goal', goal);
  }

  // ---------- Timetable ----------
  function getTimetable() {
    return _get('scholarly_timetable', null);
  }
  function saveTimetable(data) {
    _set('scholarly_timetable', data);
  }

  // ---------- Flashcard Decks ----------
  function getDecks() {
    return _get('scholarly_decks', []);
  }
  function saveDeck(deck) {
    const decks = getDecks();
    const idx = decks.findIndex(d => d.id === deck.id);
    if (idx >= 0) decks[idx] = deck;
    else decks.push(deck);
    _set('scholarly_decks', decks);
  }
  function deleteDeck(deckId) {
    const decks = getDecks().filter(d => d.id !== deckId);
    _set('scholarly_decks', decks);
  }

  // ---------- Deadlines ----------
  function getDeadlines() {
    return _get('scholarly_deadlines', [
      { id: '1', title: 'Thesis Draft Submission', subject: 'Global Economics Perspective', due: new Date(Date.now() + 4 * 3600000).toISOString() },
      { id: '2', title: 'Peer Review Workshop', subject: 'Machine Learning Fundamentals', due: new Date(Date.now() + 24 * 3600000).toISOString() },
      { id: '3', title: 'Midterm Examination', subject: 'Cognitive Psychology', due: new Date(Date.now() + 12 * 24 * 3600000).toISOString() }
    ]);
  }
  function addDeadline(deadline) {
    const deadlines = getDeadlines();
    deadline.id = deadline.id || Date.now().toString(36);
    deadlines.push(deadline);
    deadlines.sort((a, b) => new Date(a.due) - new Date(b.due));
    _set('scholarly_deadlines', deadlines);
  }
  function removeDeadline(id) {
    const deadlines = getDeadlines().filter(d => d.id !== id);
    _set('scholarly_deadlines', deadlines);
  }

  // ---------- Settings ----------
  function getSettings() {
    return _get('scholarly_settings', {
      studyDuration: 25,
      breakDuration: 5,
      dailyGoal: 120,
      focusMode: 'laptop',
      subjects: ['History', 'Algebra II', 'Physics']
    });
  }
  function saveSettings(settings) {
    _set('scholarly_settings', settings);
  }

  // ---------- Achievements ----------
  function getAchievements() {
    return _get('scholarly_achievements', []);
  }
  function unlockAchievement(achievement) {
    const achievements = getAchievements();
    if (!achievements.find(a => a.id === achievement.id)) {
      achievements.push({ ...achievement, unlockedAt: new Date().toISOString() });
      _set('scholarly_achievements', achievements);
      return true; // newly unlocked
    }
    return false;
  }

  // ---------- Today's stats helper ----------
  function getTodayStats() {
    const today = new Date().toDateString();
    const sessions = getStudySessions().filter(s => new Date(s.date).toDateString() === today);
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalPoints = sessions.reduce((sum, s) => sum + (s.points || 0), 0);
    return { sessions, totalMinutes, totalPoints, count: sessions.length };
  }

  return {
    getStudySessions, addStudySession,
    getStreak, updateStreak,
    getPoints, addPoints,
    getDailyGoal, updateDailyGoal, setDailyGoalTarget,
    getTimetable, saveTimetable,
    getDecks, saveDeck, deleteDeck,
    getDeadlines, addDeadline, removeDeadline,
    getSettings, saveSettings,
    getAchievements, unlockAchievement,
    getTodayStats
  };
})();
