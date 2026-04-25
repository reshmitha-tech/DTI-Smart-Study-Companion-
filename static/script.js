/* ==========================================================
   script.js — Smart Study Companion Client Logic
   ==========================================================
   Features:
     1. Tab navigation
     2. Timetable generation (calls Flask /generate-plan)
     3. Pomodoro Focus Timer with tab-switch detection
     4. Chatbot (calls Flask /chat)
     5. Progress tracking (localStorage)
     6. Gamification (points, streaks, achievements)
   ========================================================== */


// ─── State (stored in localStorage) ────────────────────────
const STATE_KEY = 'scholarly_state';
const GOAL_KEY = 'scholarly_daily_goal';
const STREAK_KEY = 'scholarly_streak_data';

function loadState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return {
    points: 0,
    streak: 0,
    lastStudyDate: null,
    sessions: [],        // { date, subject, minutes, points }
    achievements: [],    // unlocked achievement IDs
    totalMinutes: 0
  };
}

function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

let appState = loadState();


// ─── Daily Goal (localStorage) ─────────────────────────────
function loadDailyGoal() {
  const saved = localStorage.getItem(GOAL_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return { targetHours: 2 }; // default 2 hours
}

function saveDailyGoalData(data) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(data));
}

let dailyGoalData = loadDailyGoal();


// ─── Streak Data (localStorage) ────────────────────────────
function loadStreakData() {
  const saved = localStorage.getItem(STREAK_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return { count: 0, lastDate: null, studyDates: [] }; // studyDates: array of date strings
}

function saveStreakData(data) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

let streakData = loadStreakData();


// ─── Tab Navigation ────────────────────────────────────────
function switchTab(tabName) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Deactivate all tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  // Show selected section
  document.getElementById('section-' + tabName).classList.add('active');
  // Activate selected tab
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}


// ─── Update Header Stats ──────────────────────────────────
function updateHeaderStats() {
  document.getElementById('header-points').textContent = appState.points.toLocaleString();
  document.getElementById('header-streak').textContent = appState.streak + 'd';
}


// ═══════════════════════════════════════════════════════════
//  1. TIMETABLE GENERATOR (with Priority System)
// ═══════════════════════════════════════════════════════════

// --- Subject Priority Storage ---
let subjectPriorities = {}; // { "Math": "Hard", "English": "Easy" }

// Update priority dropdowns when subjects change
function updatePriorityList() {
  const input = document.getElementById('input-subjects').value.trim();
  const subjects = input.split(',').map(s => s.trim()).filter(Boolean);
  const container = document.getElementById('priority-container');
  const list = document.getElementById('priority-list');

  if (subjects.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  list.innerHTML = subjects.map(subj => {
    const current = subjectPriorities[subj] || 'Medium';
    return `
      <div class="priority-item">
        <span class="subject-name">${subj}</span>
        <select class="priority-select" data-subject="${subj}" onchange="setPriority('${subj}', this.value)">
          <option value="Easy" ${current === 'Easy' ? 'selected' : ''}>🟢 Easy</option>
          <option value="Medium" ${current === 'Medium' ? 'selected' : ''}>🟡 Medium</option>
          <option value="Hard" ${current === 'Hard' ? 'selected' : ''}>🔴 Hard</option>
        </select>
      </div>
    `;
  }).join('');
}

function setPriority(subject, priority) {
  subjectPriorities[subject] = priority;
  // Save to localStorage
  localStorage.setItem('scholarly_priorities', JSON.stringify(subjectPriorities));
}

// Load saved priorities
function loadPriorities() {
  try {
    const saved = localStorage.getItem('scholarly_priorities');
    if (saved) subjectPriorities = JSON.parse(saved);
  } catch(e) {}
}

async function generatePlan() {
  const subjects = document.getElementById('input-subjects').value.trim();
  const hours = document.getElementById('input-hours').value;
  const examDate = document.getElementById('input-exam-date').value;
  const resultDiv = document.getElementById('timetable-result');

  // Validate
  if (!subjects) {
    showToast('Please enter your subjects!', 'warning');
    return;
  }

  // Collect priorities for each subject
  const subjectList = subjects.split(',').map(s => s.trim()).filter(Boolean);
  const priorities = {};
  subjectList.forEach(s => {
    priorities[s] = subjectPriorities[s] || 'Medium';
  });

  // Show loading
  resultDiv.innerHTML = '<p style="text-align:center; color: var(--text-secondary);">⏳ Generating your priority-optimized study plan...</p>';

  try {
    // Call Flask backend with priorities
    const response = await fetch('/generate-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects, hours, exam_date: examDate, priorities })
    });

    if (!response.ok) {
      const err = await response.json();
      showToast(err.error || 'Error generating plan', 'error');
      return;
    }

    const data = await response.json();
    renderTimetable(data);
    showToast('Study plan generated with priority weighting!', 'success');
    addPoints(10, 'Generated a study plan');

    // Sync subjects to Focus Timer dropdown
    syncSubjectsToTimer(data.subjects);

  } catch (err) {
    showToast('Server error. Make sure Flask is running!', 'error');
    resultDiv.innerHTML = '<p style="color: var(--danger);">Failed to connect to server.</p>';
  }
}

// Sync timetable subjects into the Focus Timer subject dropdown
function syncSubjectsToTimer(subjects) {
  const select = document.getElementById('timer-subject');
  if (subjects && subjects.length > 0) {
    select.innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    // Save to localStorage for persistence
    localStorage.setItem('scholarly_subjects', JSON.stringify(subjects));
  }
}

// Subject colors for the table
const SUBJ_COLORS = ['subj-0','subj-1','subj-2','subj-3','subj-4','subj-5'];

// ── Timetable Completion Tracking ─────────────────────────
const COMPLETED_KEY = 'scholarly_completed';

function getCompleted() {
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '{}'); } catch(e) { return {}; }
}

function setCompleted(map) {
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(map));
}

function toggleSlotComplete(slotId) {
  const completed = getCompleted();
  const wasCompleted = !!completed[slotId];
  if (wasCompleted) {
    delete completed[slotId];
  } else {
    completed[slotId] = true;
    addPoints(5, 'Completed a study slot');
    showToast('+5 XP - study slot completed!', 'success');
  }
  setCompleted(completed);
  // Update the checkbox & row visuals
  const checkbox = document.getElementById('chk-' + slotId);
  const row = checkbox ? checkbox.closest('tr') : null;
  if (checkbox) checkbox.checked = !wasCompleted;
  if (row) {
    row.classList.toggle('slot-done', !wasCompleted);
    // Update status badge
    const statusEl = row.querySelector('.slot-status');
    if (statusEl) {
      statusEl.className = 'slot-status ' + (!wasCompleted ? 'done' : 'pending');
      statusEl.textContent = !wasCompleted ? 'Completed' : 'Pending';
    }
  }
  // Update day progress
  updateAllDayProgress();
}

function updateAllDayProgress() {
  const completed = getCompleted();
  document.querySelectorAll('.day-progress-bar').forEach(bar => {
    const dayId = bar.dataset.day;
    const total = parseInt(bar.dataset.total) || 1;
    const done = Object.keys(completed).filter(k => k.startsWith(dayId + '_')).length;
    const pct = Math.round((done / total) * 100);
    bar.querySelector('.day-fill').style.width = pct + '%';
    bar.querySelector('.day-pct').textContent = `${done}/${total} done (${pct}%)`;
    // Mark day header green if fully complete
    const header = bar.closest('.timetable-day');
    if (header) header.classList.toggle('day-complete', done >= total);
  });
  // Update overall progress
  updateOverallProgress();
}

function updateOverallProgress() {
  const completed = getCompleted();
  const totalSlots = document.querySelectorAll('.slot-checkbox').length;
  const doneSlots = Object.keys(completed).length;
  const pct = totalSlots > 0 ? Math.round((doneSlots / totalSlots) * 100) : 0;
  const el = document.getElementById('overall-progress');
  if (el) {
    el.querySelector('.overall-fill').style.width = pct + '%';
    el.querySelector('.overall-text').textContent = `Overall: ${doneSlots}/${totalSlots} slots completed (${pct}%)`;
  }
}

function renderTimetable(data) {
  const resultDiv = document.getElementById('timetable-result');
  const subjectColorMap = {};
  data.subjects.forEach((s, i) => { subjectColorMap[s] = SUBJ_COLORS[i % SUBJ_COLORS.length]; });
  const completed = getCompleted();

  // Subject hour summary with priority badges
  let subjectSummary = '';
  if (data.subject_hours) {
    subjectSummary = Object.entries(data.subject_hours).map(([subj, hrs]) => {
      const colorClass = subjectColorMap[subj] || 'subj-0';
      const priority = (data.priorities && data.priorities[subj]) || 'Medium';
      const badgeClass = priority.toLowerCase();
      return `<span class="subject-chip ${colorClass}" style="margin:2px">${subj}: ${hrs}h <span class="priority-badge ${badgeClass}">${priority}</span></span>`;
    }).join(' ');
  }

  let html = `
    <div class="days-badge">
      <div class="number">${data.days_left}</div>
      <div class="label">days until exam &middot; ${data.hours_per_day}h/day &middot; ${data.subjects.length} subjects &middot; ${data.total_days || data.days_left} study days</div>
    </div>
    <div style="text-align:center; margin-bottom: 16px;">${subjectSummary}</div>
    <p style="text-align:center; color: var(--accent2); margin-bottom: 20px; font-weight: 600;">
      ${data.tip}
    </p>
    <!-- Overall Completion Progress -->
    <div id="overall-progress" style="margin-bottom: 24px;">
      <div style="background: var(--bg-input); border-radius: var(--radius-full); height: 14px; overflow: hidden; border: 1px solid var(--border);">
        <div class="overall-fill" style="height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: var(--radius-full); transition: width 0.6s ease; width: 0%;"></div>
      </div>
      <p class="overall-text" style="text-align: center; color: var(--text-secondary); font-size: 0.8rem; font-weight: 600; margin-top: 6px;">Overall: 0/0 slots completed (0%)</p>
    </div>
  `;

  // Render each day
  data.timetable.forEach((day, idx) => {
    const isToday = day.is_today;
    const todayTag = isToday ? '<span style="background:var(--accent2);color:#000;padding:2px 10px;border-radius:20px;font-size:0.7rem;margin-left:8px;font-weight:700;">TODAY</span>' : '';
    const borderColor = isToday ? 'var(--accent2)' : 'var(--border)';
    const dayId = 'day' + idx;
    const studySlots = day.slots.filter(s => s.type === 'study');
    const doneCount = studySlots.filter((_, si) => completed[dayId + '_s' + si]).length;
    const dayPct = studySlots.length > 0 ? Math.round((doneCount / studySlots.length) * 100) : 0;

    html += `
      <div class="timetable-day ${doneCount >= studySlots.length && studySlots.length > 0 ? 'day-complete' : ''}" style="margin-bottom: 12px; border: 1px solid ${borderColor}; border-radius: var(--radius-lg); overflow: hidden; ${isToday ? 'box-shadow: 0 0 20px rgba(0,212,170,0.15);' : ''}">
        <div style="padding: 12px 16px; background: ${isToday ? 'rgba(0,212,170,0.1)' : 'var(--bg-card-hover)'}; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? '' : 'none'">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <h4 style="font-weight: 700; font-size: 0.9rem; color: ${isToday ? 'var(--accent2)' : 'var(--accent-light)'}; margin:0;">
              Day ${idx + 1} &mdash; ${day.day} ${todayTag}
            </h4>
            <span style="color: var(--text-muted); font-size: 0.8rem;">${studySlots.length} sessions</span>
          </div>
          <div class="day-progress-bar" data-day="${dayId}" data-total="${studySlots.length}" style="margin-top: 8px;">
            <div style="background: var(--bg-input); border-radius: var(--radius-full); height: 6px; overflow: hidden;">
              <div class="day-fill" style="height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: var(--radius-full); transition: width 0.4s ease; width: ${dayPct}%;"></div>
            </div>
            <span class="day-pct" style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; display: block;">${doneCount}/${studySlots.length} done (${dayPct}%)</span>
          </div>
        </div>
        <div style="${idx >= 7 && !isToday ? 'display:none;' : ''}">
          <table class="timetable" style="margin:0;">
            <thead><tr><th style="width:40px;"></th><th>Time</th><th>Subject</th><th style="width:90px; text-align:center;">Status</th></tr></thead>
            <tbody>
    `;

    let studyIdx = 0;
    day.slots.forEach(slot => {
      const isBreak = slot.type === 'break';
      const colorClass = isBreak ? '' : subjectColorMap[slot.subject] || 'subj-0';
      if (isBreak) {
        html += `
          <tr class="break-row">
            <td></td>
            <td>${slot.time}</td>
            <td>${slot.subject}</td>
            <td></td>
          </tr>
        `;
      } else {
        const slotId = dayId + '_s' + studyIdx;
        const isDone = !!completed[slotId];
        html += `
          <tr class="${isDone ? 'slot-done' : ''}">
            <td style="text-align:center;">
              <input type="checkbox" class="slot-checkbox" id="chk-${slotId}" ${isDone ? 'checked' : ''} onchange="toggleSlotComplete('${slotId}')" style="width:18px;height:18px;accent-color:var(--accent2);cursor:pointer;"/>
            </td>
            <td>${slot.time}</td>
            <td><span class="subject-chip ${colorClass}">${slot.subject}</span></td>
            <td style="text-align:center;">
              <span class="slot-status ${isDone ? 'done' : 'pending'}">${isDone ? 'Completed' : 'Pending'}</span>
            </td>
          </tr>
        `;
        studyIdx++;
      }
    });
    html += '</tbody></table></div></div>';
  });

  resultDiv.innerHTML = html;

  // Update overall progress bar
  setTimeout(updateOverallProgress, 100);
}


// ═══════════════════════════════════════════════════════════
//  2. POMODORO FOCUS TIMER
// ═══════════════════════════════════════════════════════════

let timerState = {
  mode: 'idle',        // idle, studying, break, paused
  remaining: 25 * 60,  // seconds
  studyDuration: 25,
  breakDuration: 5,
  interval: null,
  cyclesCompleted: 0,
  sessionStart: null,
  pausedMode: null     // what mode was before pause
};

// Distraction detection state
let distractionState = {
  active: false,
  switchCount: 0,
  lastAlert: 0
};

function initTimer() {
  updateTimerDisplay();

  // Tab visibility detection
  document.addEventListener('visibilitychange', handleTabSwitch);
  window.addEventListener('blur', handleWindowBlur);
  window.addEventListener('focus', handleWindowFocus);
}

function startTimer() {
  if (timerState.mode === 'idle') {
    // Read custom durations
    timerState.studyDuration = parseInt(document.getElementById('timer-study-min').value) || 25;
    timerState.breakDuration = parseInt(document.getElementById('timer-break-min').value) || 5;
    timerState.remaining = timerState.studyDuration * 60;
    timerState.mode = 'studying';
    timerState.sessionStart = Date.now();
    timerState.cyclesCompleted = 0;
    distractionState.active = true;
    distractionState.switchCount = 0;
    updateDistractionBar('active');
  } else if (timerState.mode === 'paused') {
    timerState.mode = timerState.pausedMode || 'studying';
    distractionState.active = true;
  } else {
    return; // Already running
  }

  timerState.interval = setInterval(tickTimer, 1000);
  updateTimerUI();
}

function pauseTimer() {
  if (timerState.mode === 'studying' || timerState.mode === 'break') {
    timerState.pausedMode = timerState.mode;
    timerState.mode = 'paused';
    clearInterval(timerState.interval);
    updateTimerUI();
  }
}

function resetTimer() {
  clearInterval(timerState.interval);
  timerState.mode = 'idle';
  timerState.remaining = (parseInt(document.getElementById('timer-study-min').value) || 25) * 60;
  timerState.cyclesCompleted = 0;
  timerState.sessionStart = null;
  distractionState.active = false;
  distractionState.switchCount = 0;
  updateTimerDisplay();
  updateTimerUI();
  updateDistractionBar('inactive');
}

function finishSession() {
  // Calculate study minutes
  const elapsed = timerState.sessionStart ? Math.floor((Date.now() - timerState.sessionStart) / 60000) : 0;
  const subject = document.getElementById('timer-subject').value.trim() || 'General';
  const mins = Math.max(elapsed, 1);
  const pts = mins * 2 + timerState.cyclesCompleted * 10;

  // Log session
  logSession(subject, mins, pts);
  addPoints(pts, `Studied ${subject} for ${mins}m`);

  // Update daily goal progress
  updateDailyGoalProgress(mins);

  // Record study day for streak & consistency
  recordStudyDay();

  showToast(`🎉 Session saved! +${pts} XP for ${mins}m of ${subject}`, 'success');
  resetTimer();
  updateProgressUI();
  updateDashboardWidgets();
}

function tickTimer() {
  timerState.remaining--;

  if (timerState.remaining <= 0) {
    clearInterval(timerState.interval);

    if (timerState.mode === 'studying') {
      // Study phase complete → switch to break
      timerState.cyclesCompleted++;
      timerState.mode = 'break';
      timerState.remaining = timerState.breakDuration * 60;
      showToast('🎉 Study cycle complete! Take a break.', 'success');
      playBeep();
    } else if (timerState.mode === 'break') {
      // Break complete → switch to study
      timerState.mode = 'studying';
      timerState.remaining = timerState.studyDuration * 60;
      showToast('⏰ Break over — time to focus!', 'info');
      playBeep();
    }

    timerState.interval = setInterval(tickTimer, 1000);
  }

  updateTimerDisplay();
  updateTimerUI();
}

function updateTimerDisplay() {
  const mins = Math.floor(timerState.remaining / 60);
  const secs = timerState.remaining % 60;
  document.getElementById('timer-display').textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  // Update title
  if (timerState.mode !== 'idle') {
    document.title = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')} — Scholarly`;
  } else {
    document.title = 'Smart Study Companion';
  }
}

function updateTimerUI() {
  const ring = document.getElementById('timer-ring');
  const phase = document.getElementById('timer-phase');
  const cycle = document.getElementById('timer-cycle');
  const startBtn = document.getElementById('btn-start');
  const pauseBtn = document.getElementById('btn-pause');
  const finishBtn = document.getElementById('btn-finish');

  ring.className = 'timer-ring';
  if (timerState.mode === 'studying') ring.classList.add('studying');
  if (timerState.mode === 'break') ring.classList.add('on-break');
  if (timerState.mode === 'paused') ring.classList.add('paused');

  phase.textContent = {
    idle: 'Ready', studying: '📖 Studying', break: '☕ Break', paused: '⏸ Paused'
  }[timerState.mode] || 'Ready';

  cycle.textContent = `Cycle ${timerState.cyclesCompleted + (timerState.mode === 'studying' ? 1 : 0)}`;

  // Button states
  startBtn.style.display = (timerState.mode === 'studying' || timerState.mode === 'break') ? 'none' : '';
  pauseBtn.style.display = (timerState.mode === 'studying' || timerState.mode === 'break') ? '' : 'none';
  finishBtn.style.display = timerState.mode === 'idle' ? 'none' : '';
  startBtn.textContent = timerState.mode === 'paused' ? '▶ Resume' : '▶ Start';
}

// ── Tab Switch / Distraction Detection ─────────────────────
function handleTabSwitch() {
  if (!distractionState.active) return;
  if (document.hidden) {
    triggerDistraction();
  } else {
    returnFromDistraction();
  }
}

function handleWindowBlur() {
  if (!distractionState.active) return;
  triggerDistraction();
}

function handleWindowFocus() {
  if (!distractionState.active) return;
  returnFromDistraction();
}

function triggerDistraction() {
  distractionState.switchCount++;
  const now = Date.now();

  // Don't spam alerts — cooldown of 3 seconds
  if (now - distractionState.lastAlert > 3000) {
    distractionState.lastAlert = now;
    showToast(`⚠️ Distraction detected! (${distractionState.switchCount} tab switches)`, 'warning');
    playBeep();
  }

  updateDistractionBar(distractionState.switchCount > 5 ? 'danger' : 'warning');
}

function returnFromDistraction() {
  updateDistractionBar(distractionState.switchCount > 5 ? 'warning' : 'active');
}

function updateDistractionBar(level) {
  const bar = document.getElementById('distraction-bar');
  bar.className = 'distraction-bar';
  if (level !== 'inactive') bar.classList.add(level);

  const labels = {
    inactive: '⚪ Distraction Detector: Inactive',
    active:   '🟢 Focus Status: Optimal',
    warning:  `🟡 Focus Alert: ${distractionState.switchCount} tab switch(es)`,
    danger:   `🔴 High Distraction: ${distractionState.switchCount} tab switches!`
  };
  document.getElementById('distraction-text').textContent = labels[level] || labels.inactive;
}

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch(e) {}
}


// ═══════════════════════════════════════════════════════════
//  3. CHATBOT
// ═══════════════════════════════════════════════════════════

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  // Show user message
  appendChatMsg(message, 'user');
  input.value = '';

  // Show typing indicator
  const typingEl = appendChatMsg('', 'typing');

  try {
    // Call Flask backend
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    });
    const data = await res.json();

    // Remove typing, show response
    typingEl.remove();
    appendChatMsg(data.reply, 'bot');

  } catch(err) {
    typingEl.remove();
    appendChatMsg("Sorry, I couldn't connect to the server. Please check that Flask is running!", 'bot');
  }
}

function sendQuickReply(message) {
  document.getElementById('chat-input').value = message;
  sendChat();
}

function appendChatMsg(text, type) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');

  if (type === 'typing') {
    div.className = 'chat-msg bot typing';
    div.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
  } else if (type === 'bot') {
    div.className = 'chat-msg bot';
    // Convert newlines to <br> for multi-line bot responses
    const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    div.innerHTML = escaped.replace(/\n/g, '<br>');
    div.style.whiteSpace = 'pre-line';
  } else {
    div.className = 'chat-msg user';
    div.textContent = text;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}


// ═══════════════════════════════════════════════════════════
//  4. PROGRESS / ANALYTICS
// ═══════════════════════════════════════════════════════════

function logSession(subject, minutes, points) {
  const session = {
    date: new Date().toISOString(),
    subject: subject,
    minutes: minutes,
    points: points
  };
  appState.sessions.push(session);
  appState.totalMinutes += minutes;
  saveState(appState);
}

function updateProgressUI() {
  // Today's minutes
  const today = new Date().toDateString();
  const todayMins = appState.sessions
    .filter(s => new Date(s.date).toDateString() === today)
    .reduce((sum, s) => sum + s.minutes, 0);

  document.getElementById('stat-today-mins').textContent = todayMins + 'm';
  document.getElementById('stat-total-sessions').textContent = appState.sessions.length;
  document.getElementById('stat-total-mins').textContent = appState.totalMinutes + 'm';
  document.getElementById('stat-avg-focus').textContent =
    appState.sessions.length > 0
      ? Math.round(appState.totalMinutes / appState.sessions.length) + 'm'
      : '0m';

  // Weekly bar chart
  renderWeeklyChart();

  // Session history
  renderSessionList();
}

function renderWeeklyChart() {
  const chart = document.getElementById('weekly-chart');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const now = new Date();
  const weekData = new Array(7).fill(0);

  appState.sessions.forEach(s => {
    const d = new Date(s.date);
    const diff = Math.floor((now - d) / 86400000);
    if (diff >= 0 && diff < 7) {
      const dayIndex = d.getDay();
      weekData[dayIndex] += s.minutes;
    }
  });

  const maxVal = Math.max(...weekData, 1);
  const todayIdx = now.getDay();

  chart.innerHTML = weekData.map((val, i) => {
    const height = Math.max((val / maxVal) * 150, 4);
    return `
      <div class="bar-col">
        <div class="bar-value">${val}m</div>
        <div class="bar-fill ${i === todayIdx ? 'today' : ''}" style="height: ${height}px;"></div>
        <div class="bar-label">${days[i]}</div>
      </div>
    `;
  }).join('');
}

function renderSessionList() {
  const list = document.getElementById('session-list');
  const recent = appState.sessions.slice(-10).reverse();

  if (recent.length === 0) {
    list.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 24px;">No sessions yet. Start studying to track your progress!</p>';
    return;
  }

  list.innerHTML = recent.map(s => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="session-item">
        <div>
          <strong>${s.subject}</strong>
          <span style="color: var(--text-muted); margin-left: 8px;">${dateStr} at ${timeStr}</span>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="color: var(--text-secondary);">${s.minutes}m</span>
          <span class="xp-badge">+${s.points} XP</span>
        </div>
      </div>
    `;
  }).join('');
}


// ═══════════════════════════════════════════════════════════
//  5. GAMIFICATION
// ═══════════════════════════════════════════════════════════

const ACHIEVEMENTS = [
  { id: 'first_session', icon: '🌟', title: 'First Steps', desc: 'Complete your first study session', check: () => appState.sessions.length >= 1 },
  { id: 'five_sessions', icon: '📚', title: 'Bookworm', desc: 'Complete 5 study sessions', check: () => appState.sessions.length >= 5 },
  { id: 'ten_sessions', icon: '🏆', title: 'Scholar', desc: 'Complete 10 study sessions', check: () => appState.sessions.length >= 10 },
  { id: 'hour_club', icon: '⏰', title: 'Hour Club', desc: 'Study for 60+ minutes total', check: () => appState.totalMinutes >= 60 },
  { id: 'century', icon: '💯', title: 'Century', desc: 'Earn 100+ points', check: () => appState.points >= 100 },
  { id: 'streak_3', icon: '🔥', title: 'On Fire!', desc: 'Maintain a 3-day streak', check: () => appState.streak >= 3 },
  { id: 'streak_7', icon: '👑', title: 'Week Warrior', desc: 'Maintain a 7-day streak', check: () => appState.streak >= 7 },
  { id: 'five_hundred', icon: '💎', title: 'Diamond Student', desc: 'Earn 500+ points', check: () => appState.points >= 500 },
];

function addPoints(amount, reason) {
  appState.points += amount;

  // Update streak
  const today = new Date().toDateString();
  if (appState.lastStudyDate) {
    const last = new Date(appState.lastStudyDate).toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (last === yesterday) {
      appState.streak++;
    } else if (last !== today) {
      appState.streak = 1;
    }
    // If same day, streak stays the same
  } else {
    appState.streak = 1;
  }
  appState.lastStudyDate = new Date().toISOString();

  saveState(appState);
  updateHeaderStats();
  checkAchievements();
  updateDashboardWidgets();
}

function checkAchievements() {
  ACHIEVEMENTS.forEach(ach => {
    if (!appState.achievements.includes(ach.id) && ach.check()) {
      appState.achievements.push(ach.id);
      saveState(appState);
      showToast(`🏅 Achievement Unlocked: ${ach.title}!`, 'success');
    }
  });
  updateGamificationUI();
}

function updateGamificationUI() {
  // Points and streak display
  document.getElementById('game-points').textContent = appState.points.toLocaleString();
  document.getElementById('game-streak').textContent = appState.streak;
  document.getElementById('game-level').textContent = Math.floor(appState.points / 100) + 1;
  document.getElementById('game-sessions').textContent = appState.sessions.length;

  // Level progress bar
  const levelProgress = (appState.points % 100);
  document.getElementById('level-progress').style.width = levelProgress + '%';
  document.getElementById('level-text').textContent = `Level ${Math.floor(appState.points / 100) + 1} — ${levelProgress}/100 XP to next level`;

  // Achievements list
  const achList = document.getElementById('achievements-list');
  achList.innerHTML = ACHIEVEMENTS.map(ach => {
    const unlocked = appState.achievements.includes(ach.id);
    return `
      <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
        <div class="ach-icon">${ach.icon}</div>
        <div>
          <div class="ach-title">${ach.title}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
        ${unlocked ? '<span style="margin-left:auto; color: var(--success); font-size: 1.2rem;">✓</span>' : ''}
      </div>
    `;
  }).join('');

  updateHeaderStats();
}


// ═══════════════════════════════════════════════════════════
//  6. STREAK SYSTEM (localStorage)
// ═══════════════════════════════════════════════════════════

function recordStudyDay() {
  const today = new Date().toDateString();

  // Add today to study dates if not already there
  if (!streakData.studyDates.includes(today)) {
    streakData.studyDates.push(today);
  }

  // Keep only last 30 days of data
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toDateString();
  streakData.studyDates = streakData.studyDates.filter(d => new Date(d) >= new Date(thirtyDaysAgo));

  // Calculate streak
  if (streakData.lastDate === today) {
    // Already counted today
  } else {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (streakData.lastDate === yesterday) {
      streakData.count += 1;
    } else if (streakData.lastDate !== today) {
      streakData.count = 1; // reset streak
    }
    streakData.lastDate = today;
  }

  saveStreakData(streakData);
  updateDashboardWidgets();
}


// ═══════════════════════════════════════════════════════════
//  7. CONSISTENCY SCORE
// ═══════════════════════════════════════════════════════════

function calculateConsistency() {
  // Consistency = how many of the last 7 days had study activity
  const now = new Date();
  let activeDays = 0;

  for (let i = 0; i < 7; i++) {
    const dateToCheck = new Date(now - i * 86400000).toDateString();

    // Check if there were sessions on this day
    const hadSession = appState.sessions.some(s =>
      new Date(s.date).toDateString() === dateToCheck
    );

    // Also check streakData study dates
    const inStudyDates = streakData.studyDates.includes(dateToCheck);

    if (hadSession || inStudyDates) {
      activeDays++;
    }
  }

  return Math.round((activeDays / 7) * 100);
}


// ═══════════════════════════════════════════════════════════
//  8. DAILY GOAL TRACKER
// ═══════════════════════════════════════════════════════════

function getTodayStudyMinutes() {
  const today = new Date().toDateString();
  return appState.sessions
    .filter(s => new Date(s.date).toDateString() === today)
    .reduce((sum, s) => sum + s.minutes, 0);
}

function updateDailyGoalProgress(additionalMinutes) {
  // This is called after finishing a session; the session is already logged
  // Just refresh the widget display
  updateDashboardWidgets();
}

function openGoalModal() {
  document.getElementById('goal-modal').style.display = 'flex';
  document.getElementById('goal-hours-input').value = dailyGoalData.targetHours;
}

function closeGoalModal() {
  document.getElementById('goal-modal').style.display = 'none';
}

function saveDailyGoal() {
  const hours = parseFloat(document.getElementById('goal-hours-input').value) || 2;
  dailyGoalData.targetHours = Math.max(0.5, Math.min(12, hours));
  saveDailyGoalData(dailyGoalData);
  closeGoalModal();
  updateDashboardWidgets();
  showToast(`Daily goal set to ${dailyGoalData.targetHours}h!`, 'success');
}


// ═══════════════════════════════════════════════════════════
//  9. DASHBOARD WIDGET UPDATES
// ═══════════════════════════════════════════════════════════

function updateDashboardWidgets() {
  // --- Streak Widget ---
  const streakCount = streakData.count || appState.streak || 0;
  const streakEl = document.getElementById('dash-streak');
  if (streakEl) {
    streakEl.textContent = streakCount;
    // Add pulse animation if streak > 0
    const streakWidget = document.getElementById('streak-widget');
    if (streakCount > 0) {
      streakWidget.classList.add('streak-active');
    }
  }

  // --- Consistency Score Widget ---
  const consistency = calculateConsistency();
  const consistencyEl = document.getElementById('dash-consistency');
  if (consistencyEl) {
    consistencyEl.textContent = consistency + '%';
  }
  const consistencyFill = document.getElementById('consistency-fill');
  if (consistencyFill) {
    setTimeout(() => { consistencyFill.style.width = consistency + '%'; }, 100);
  }

  // --- Daily Goal Widget ---
  const todayMins = getTodayStudyMinutes();
  const targetMins = (dailyGoalData.targetHours || 2) * 60;
  const goalHoursStudied = (todayMins / 60).toFixed(1);
  const goalPct = Math.min(100, Math.round((todayMins / targetMins) * 100));

  const goalProgressEl = document.getElementById('dash-goal-progress');
  if (goalProgressEl) {
    goalProgressEl.textContent = `${goalHoursStudied}h / ${dailyGoalData.targetHours}h`;
  }
  const goalFill = document.getElementById('goal-fill');
  if (goalFill) {
    setTimeout(() => { goalFill.style.width = goalPct + '%'; }, 100);
  }

  // --- XP Widget ---
  const xpEl = document.getElementById('dash-xp');
  if (xpEl) {
    xpEl.textContent = appState.points.toLocaleString();
  }

  // --- Header streak badge ---
  const headerStreakBadge = document.querySelector('.streak-badge');
  if (headerStreakBadge && streakCount > 0) {
    headerStreakBadge.classList.add('streak-active');
  }
}


// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}


// ═══════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all modules
  initTimer();
  loadPriorities();
  updateHeaderStats();
  updateProgressUI();
  updateGamificationUI();
  updateDashboardWidgets();

  // Chat Enter key
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  // Show initial chatbot greeting
  appendChatMsg("Hello! I'm your Scholarly Study Assistant. Ask me about study tips, focus strategies, exam prep, or motivation!", 'bot');

  // Restore saved subjects into timer dropdown
  const savedSubjects = localStorage.getItem('scholarly_subjects');
  if (savedSubjects) {
    try {
      const subjects = JSON.parse(savedSubjects);
      if (subjects.length > 0) {
        syncSubjectsToTimer(subjects);
      }
    } catch(e) {}
  }

  // Live-sync: when user types subjects, update timer dropdown AND priority list
  document.getElementById('input-subjects').addEventListener('input', function() {
    const subjects = this.value.split(',').map(s => s.trim()).filter(Boolean);
    if (subjects.length > 0) {
      syncSubjectsToTimer(subjects);
    }
    // Update priority dropdowns
    updatePriorityList();
  });

  // Close goal modal on overlay click
  document.getElementById('goal-modal').addEventListener('click', function(e) {
    if (e.target === this) closeGoalModal();
  });

  // Default tab
  switchTab('timetable');
});
