/* ===================================================
   timer.js — Pomodoro Timer Engine
   =================================================== */

const Timer = (() => {
  let state = 'idle'; // idle | studying | break | paused
  let totalSeconds = 0;
  let remainingSeconds = 0;
  let intervalId = null;
  let studyDuration = 25 * 60; // seconds
  let breakDuration = 5 * 60;
  let sessionStartTime = null;
  let pausedState = null; // which state we were in before pause
  let onTick = null;
  let onStateChange = null;
  let onComplete = null;
  let elapsedStudySeconds = 0;

  function configure(opts) {
    if (opts.studyMinutes) studyDuration = opts.studyMinutes * 60;
    if (opts.breakMinutes) breakDuration = opts.breakMinutes * 60;
    if (opts.onTick) onTick = opts.onTick;
    if (opts.onStateChange) onStateChange = opts.onStateChange;
    if (opts.onComplete) onComplete = opts.onComplete;
  }

  function start() {
    if (state === 'idle' || state === 'break') {
      state = 'studying';
      totalSeconds = studyDuration;
      remainingSeconds = studyDuration;
      sessionStartTime = Date.now();
      _emitStateChange();
      _startInterval();
    } else if (state === 'paused') {
      state = pausedState || 'studying';
      pausedState = null;
      _emitStateChange();
      _startInterval();
    }
  }

  function pause() {
    if (state === 'studying' || state === 'break') {
      pausedState = state;
      state = 'paused';
      _stopInterval();
      _emitStateChange();
    }
  }

  function reset() {
    _stopInterval();
    if (state === 'studying' || state === 'paused') {
      const studied = totalSeconds - remainingSeconds;
      if (studied > 60) elapsedStudySeconds += studied;
    }
    state = 'idle';
    remainingSeconds = studyDuration;
    totalSeconds = studyDuration;
    _emitStateChange();
    if (onTick) onTick(remainingSeconds, totalSeconds);
  }

  function skip() {
    _stopInterval();
    if (state === 'studying') {
      elapsedStudySeconds += totalSeconds - remainingSeconds;
      _startBreak();
    } else if (state === 'break') {
      _startStudy();
    }
  }

  function getState() { return state; }
  function getRemaining() { return remainingSeconds; }
  function getTotal() { return totalSeconds; }
  function getElapsedStudyMinutes() { return Math.floor(elapsedStudySeconds / 60); }
  function getPhaseLabel() {
    switch(state) {
      case 'studying': return 'Focus Phase';
      case 'break': return 'Break Time';
      case 'paused': return 'Paused';
      default: return 'Ready';
    }
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // --- private ---
  function _startInterval() {
    _stopInterval();
    intervalId = setInterval(() => {
      remainingSeconds--;
      if (onTick) onTick(remainingSeconds, totalSeconds);
      if (remainingSeconds <= 0) {
        _stopInterval();
        if (state === 'studying') {
          elapsedStudySeconds += totalSeconds;
          _startBreak();
          if (onComplete) onComplete('study');
        } else if (state === 'break') {
          _startStudy();
          if (onComplete) onComplete('break');
        }
      }
    }, 1000);
  }

  function _stopInterval() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  function _startBreak() {
    state = 'break';
    totalSeconds = breakDuration;
    remainingSeconds = breakDuration;
    _emitStateChange();
    _startInterval();
  }

  function _startStudy() {
    state = 'studying';
    totalSeconds = studyDuration;
    remainingSeconds = studyDuration;
    _emitStateChange();
    _startInterval();
  }

  function _emitStateChange() {
    if (onStateChange) onStateChange(state);
  }

  // Finish session and log it
  function finishSession(subject, mode) {
    _stopInterval();
    if (state === 'studying') {
      elapsedStudySeconds += totalSeconds - remainingSeconds;
    }
    const minutes = Math.max(1, Math.floor(elapsedStudySeconds / 60));
    const points = Gamification.awardSession(minutes);
    Store.addStudySession({
      subject: subject || 'General',
      duration: minutes,
      mode: mode || 'laptop',
      points: points,
      type: 'focus'
    });
    Store.updateDailyGoal(minutes);
    const result = { minutes, points };
    elapsedStudySeconds = 0;
    state = 'idle';
    remainingSeconds = studyDuration;
    totalSeconds = studyDuration;
    _emitStateChange();
    if (onTick) onTick(remainingSeconds, totalSeconds);
    return result;
  }

  return {
    configure, start, pause, reset, skip, finishSession,
    getState, getRemaining, getTotal, getElapsedStudyMinutes, getPhaseLabel,
    formatTime
  };
})();
