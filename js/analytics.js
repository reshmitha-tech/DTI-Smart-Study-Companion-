/* ===================================================
   analytics.js — Progress Charts & Stats Computation
   =================================================== */

const Analytics = (() => {

  function getWeeklyData() {
    const sessions = Store.getStudySessions();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const daySessions = sessions.filter(s => new Date(s.date).toDateString() === dateStr);
      const totalMin = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
      weekData.push({
        label: days[d.getDay()],
        date: dateStr,
        minutes: totalMin,
        sessions: daySessions.length,
        points: daySessions.reduce((sum, s) => sum + (s.points || 0), 0)
      });
    }
    return weekData;
  }

  function getSubjectBreakdown() {
    const sessions = Store.getStudySessions();
    const subjects = {};
    sessions.forEach(s => {
      const key = s.subject || 'General';
      if (!subjects[key]) subjects[key] = { minutes: 0, sessions: 0, points: 0 };
      subjects[key].minutes += s.duration || 0;
      subjects[key].sessions += 1;
      subjects[key].points += s.points || 0;
    });
    return Object.entries(subjects)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.minutes - a.minutes);
  }

  function getTotalStats() {
    const sessions = Store.getStudySessions();
    const total = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const today = Store.getTodayStats();
    const thisWeek = getWeeklyData().reduce((sum, d) => sum + d.minutes, 0);
    return {
      allTime: total,
      thisWeek,
      today: today.totalMinutes,
      totalSessions: sessions.length,
      totalPoints: Store.getPoints(),
      streak: Store.getStreak().count
    };
  }

  function getStreakCalendar() {
    const sessions = Store.getStudySessions();
    const now = new Date();
    const days = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const hasSession = sessions.some(s => new Date(s.date).toDateString() === dateStr);
      const totalMin = sessions.filter(s => new Date(s.date).toDateString() === dateStr)
        .reduce((sum, s) => sum + (s.duration || 0), 0);
      days.push({
        date: dateStr,
        dayNum: d.getDate(),
        active: hasSession,
        intensity: totalMin > 120 ? 3 : totalMin > 60 ? 2 : totalMin > 0 ? 1 : 0
      });
    }
    return days;
  }

  function renderBarChart(container, data, maxValue) {
    if (!container) return;
    const max = maxValue || Math.max(...data.map(d => d.minutes), 30);
    container.innerHTML = data.map(d => {
      const pct = Math.max(4, (d.minutes / max) * 100);
      const isToday = d.date === new Date().toDateString();
      return `
        <div class="bar ${isToday ? 'bg-primary' : 'bg-primary/40'}" style="height: ${pct}%" title="${d.minutes} min">
          <span class="bar-label ${isToday ? 'text-primary font-black' : ''}">${d.label}</span>
        </div>`;
    }).join('');
  }

  function renderSubjectBars(container, data) {
    if (!container) return;
    const max = Math.max(...data.map(d => d.minutes), 1);
    const colors = ['bg-primary', 'bg-tertiary', 'bg-secondary', 'bg-error', 'bg-primary-fixed-dim'];
    container.innerHTML = data.map((d, i) => {
      const pct = (d.minutes / max) * 100;
      return `
        <div class="mb-4">
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm font-bold text-on-surface">${d.name}</span>
            <span class="text-xs font-bold text-on-surface-variant">${d.minutes}m · ${d.sessions} sessions</span>
          </div>
          <div class="h-2 bg-surface-container rounded-full overflow-hidden">
            <div class="${colors[i % colors.length]} h-full rounded-full transition-all duration-700" style="width: ${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderStreakCalendar(container, data) {
    if (!container) return;
    const intensityColors = [
      'bg-surface-container-highest/30',
      'bg-primary/30',
      'bg-primary/60',
      'bg-primary'
    ];
    container.innerHTML = data.map(d => `
      <div class="heatmap-dot ${intensityColors[d.intensity]}" title="${d.date}: ${d.intensity > 0 ? 'Active' : 'No study'}">
      </div>
    `).join('');
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return {
    getWeeklyData, getSubjectBreakdown, getTotalStats, getStreakCalendar,
    renderBarChart, renderSubjectBars, renderStreakCalendar, formatDuration
  };
})();
