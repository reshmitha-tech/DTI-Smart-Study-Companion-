/* ===================================================
   timetable.js — Timetable Generation Algorithm
   =================================================== */

const TimetableGen = (() => {
  const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const COLORS = [
    { bg: 'bg-primary-container', border: 'border-primary', text: 'text-primary' },
    { bg: 'bg-on-secondary-fixed-variant', border: 'border-on-secondary-container', text: 'text-on-secondary-container' },
    { bg: 'bg-tertiary-container', border: 'border-tertiary', text: 'text-tertiary' },
    { bg: 'bg-secondary-container', border: 'border-secondary', text: 'text-secondary' },
    { bg: 'bg-error-container', border: 'border-error', text: 'text-error' },
    { bg: 'bg-surface-container-highest', border: 'border-primary', text: 'text-primary' }
  ];

  function generate(subjects, dailyHours, intensity) {
    if (!subjects || subjects.length === 0) return null;

    // intensity: 'steady' = spread out, 'peak' = morning heavy, 'grind' = max packing
    const slotsPerDay = Math.min(dailyHours, TIME_SLOTS.length - 1); // -1 for lunch break
    const grid = {}; // { "Mon_08:00": { subject, color } }
    const subjectColors = {};

    subjects.forEach((sub, i) => {
      subjectColors[sub] = COLORS[i % COLORS.length];
    });

    // Create available slots per day (exclude lunch at 12:00)
    const availableSlots = TIME_SLOTS.filter(t => t !== '12:00');

    // Determine which slots to use based on intensity
    let preferredSlots;
    if (intensity === 'peak') {
      // Morning focus: prioritize early slots
      preferredSlots = availableSlots.slice(0, slotsPerDay);
    } else if (intensity === 'grind') {
      // Fill as many as possible
      preferredSlots = availableSlots.slice(0, Math.min(slotsPerDay + 2, availableSlots.length));
    } else {
      // Steady: spread evenly with gaps
      preferredSlots = [];
      const step = Math.max(1, Math.floor(availableSlots.length / slotsPerDay));
      for (let i = 0; i < availableSlots.length && preferredSlots.length < slotsPerDay; i += step) {
        preferredSlots.push(availableSlots[i]);
      }
    }

    // Distribute subjects across the week
    DAYS.forEach((day, dayIdx) => {
      // Sunday: reduced schedule
      const daySlots = day === 'Sun'
        ? preferredSlots.slice(0, Math.ceil(preferredSlots.length / 2))
        : preferredSlots;

      daySlots.forEach((slot, slotIdx) => {
        // Round-robin assignment with some variation
        const subjectIdx = (slotIdx + dayIdx) % subjects.length;
        grid[`${day}_${slot}`] = {
          subject: subjects[subjectIdx],
          color: subjectColors[subjects[subjectIdx]]
        };
      });
    });

    const timetable = { grid, subjects, subjectColors, dailyHours, intensity, generatedAt: new Date().toISOString() };
    Store.saveTimetable(timetable);
    return timetable;
  }

  function renderGrid(timetable, containerEl) {
    if (!timetable || !containerEl) return;

    let html = '';
    // Header row
    html += '<div class="h-10"></div>';
    DAYS.forEach(day => {
      html += `<div class="text-center py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">${day}</div>`;
    });

    // Time rows
    TIME_SLOTS.forEach(slot => {
      // Time label
      html += `<div class="text-right pr-3 py-4 text-[10px] font-bold text-on-surface-variant uppercase">${slot}</div>`;

      if (slot === '12:00') {
        // Lunch break
        html += `<div class="col-span-7 bg-surface-container-highest/50 flex items-center justify-center border-y border-outline-variant/10 min-h-[50px]">
          <span class="text-[8px] font-bold tracking-[0.5em] text-on-surface-variant uppercase">Intermission • Nourishment</span>
        </div>`;
        return;
      }

      // Day cells
      DAYS.forEach(day => {
        const key = `${day}_${slot}`;
        const cell = timetable.grid[key];
        if (cell) {
          html += `<div class="${cell.color.bg} border-l-2 ${cell.color.border} p-2 rounded-sm min-h-[50px]">
            <p class="text-[9px] font-bold ${cell.color.text} mb-1">${cell.subject.toUpperCase()}</p>
          </div>`;
        } else {
          html += `<div class="bg-surface-container-highest/30 rounded-sm min-h-[50px]"></div>`;
        }
      });
    });

    containerEl.innerHTML = html;
  }

  function getEfficiencyScore(timetable) {
    if (!timetable) return 0;
    const filledSlots = Object.keys(timetable.grid).length;
    const totalSlots = (TIME_SLOTS.length - 1) * DAYS.length; // exclude lunch
    return Math.round((filledSlots / totalSlots) * 100);
  }

  return { generate, renderGrid, getEfficiencyScore, TIME_SLOTS, DAYS, COLORS };
})();
