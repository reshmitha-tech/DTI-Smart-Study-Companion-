/* ===================================================
   focus-detect.js — Tab Visibility & Distraction Detection
   =================================================== */

const FocusDetect = (() => {
  let isActive = false;
  let tabSwitchCount = 0;
  let lastSwitchTime = null;
  let totalFocusedTime = 0;
  let startTime = null;
  let focusLostTime = null;
  let onDistraction = null;
  let onReturn = null;
  let statusEl = null;
  let audioAlert = null;
  let _boundVisChange = null;
  let _boundBlur = null;
  let _boundFocus = null;

  function init(opts = {}) {
    onDistraction = opts.onDistraction || null;
    onReturn = opts.onReturn || null;
    statusEl = opts.statusElement || null;

    // Create beep for alerts
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioAlert = new AudioContext();
    } catch(e) {}

    // Bind handlers
    _boundVisChange = _handleVisibilityChange.bind(this);
    _boundBlur = _handleBlur.bind(this);
    _boundFocus = _handleFocus.bind(this);

    document.addEventListener('visibilitychange', _boundVisChange);
    window.addEventListener('blur', _boundBlur);
    window.addEventListener('focus', _boundFocus);
  }

  function start() {
    isActive = true;
    tabSwitchCount = 0;
    totalFocusedTime = 0;
    startTime = Date.now();
    focusLostTime = null;
    _updateStatus('optimal');
  }

  function stop() {
    isActive = false;
    _updateStatus('inactive');
  }

  function getStats() {
    if (!isActive || !startTime) {
      return { tabSwitchCount: 0, concentration: 100, totalMinutes: 0 };
    }
    const elapsed = (Date.now() - startTime) / 1000;
    let focusedTime = totalFocusedTime;
    // If currently focused, add the time since last focus return
    if (!document.hidden && focusLostTime === null) {
      focusedTime = elapsed; // all focused if never lost
    }
    // If we've had distractions, compute properly
    if (tabSwitchCount > 0) {
      const lostNow = focusLostTime ? (Date.now() - focusLostTime) / 1000 : 0;
      focusedTime = Math.max(0, elapsed - lostNow);
      // Reduce based on number of switches
      const penalty = Math.min(tabSwitchCount * 5, 50); // up to 50% penalty
      focusedTime = focusedTime * ((100 - penalty) / 100);
    }
    const concentration = elapsed > 0
      ? Math.round((focusedTime / elapsed) * 100)
      : 100;
    return {
      tabSwitchCount,
      concentration: Math.min(100, Math.max(0, concentration)),
      totalMinutes: Math.floor(elapsed / 60)
    };
  }

  function _handleBlur() {
    if (!isActive) return;
    _triggerDistraction();
  }

  function _handleFocus() {
    if (!isActive) return;
    _triggerReturn();
  }

  function _handleVisibilityChange() {
    if (!isActive) return;
    if (document.hidden) {
      _triggerDistraction();
    } else {
      _triggerReturn();
    }
  }

  function _triggerDistraction() {
    if (focusLostTime) return; // already tracking a distraction
    tabSwitchCount++;
    focusLostTime = Date.now();
    lastSwitchTime = Date.now();

    _updateStatus(tabSwitchCount > 3 ? 'alert' : 'warning');
    _playBeep();

    if (onDistraction) onDistraction(tabSwitchCount);
  }

  function _triggerReturn() {
    if (focusLostTime) {
      focusLostTime = null;
    }
    _updateStatus(tabSwitchCount > 5 ? 'alert' : tabSwitchCount > 2 ? 'warning' : 'optimal');
    if (onReturn) onReturn(tabSwitchCount);
  }

  function _updateStatus(level) {
    if (!statusEl) return;
    const labels = {
      optimal: { text: 'Optimal', color: 'text-tertiary', dot: 'bg-tertiary' },
      warning: { text: 'Distracted', color: 'text-yellow-400', dot: 'bg-yellow-400' },
      alert: { text: 'High Distraction!', color: 'text-error', dot: 'bg-error' },
      inactive: { text: 'Inactive', color: 'text-on-surface-variant', dot: 'bg-on-surface-variant' }
    };
    const s = labels[level] || labels.inactive;
    statusEl.innerHTML = `
      <div class="w-2 h-2 rounded-full ${s.dot} ${level === 'optimal' ? 'animate-pulse' : ''}"></div>
      <span class="text-xs font-bold tracking-widest uppercase text-on-surface-variant">Distraction Detector</span>
      <div class="w-px h-4 bg-outline-variant/30"></div>
      <span class="text-xs font-bold tracking-widest uppercase ${s.color}">Status: ${s.text}</span>
      ${tabSwitchCount > 0 ? `<div class="w-px h-4 bg-outline-variant/30"></div><span class="text-xs font-bold tracking-widest uppercase text-error">${tabSwitchCount} switch${tabSwitchCount > 1 ? 'es' : ''}</span>` : ''}
    `;
  }

  function _playBeep() {
    if (!audioAlert) return;
    try {
      // Resume context if suspended (needed after user interaction)
      if (audioAlert.state === 'suspended') audioAlert.resume();
      const osc = audioAlert.createOscillator();
      const gain = audioAlert.createGain();
      osc.connect(gain);
      gain.connect(audioAlert.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(audioAlert.currentTime + 0.25);
    } catch(e) {}
  }

  function destroy() {
    document.removeEventListener('visibilitychange', _boundVisChange);
    window.removeEventListener('blur', _boundBlur);
    window.removeEventListener('focus', _boundFocus);
    isActive = false;
  }

  return { init, start, stop, getStats, destroy };
})();
