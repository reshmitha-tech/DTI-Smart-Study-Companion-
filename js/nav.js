/* ===================================================
   nav.js — Shared navigation injection
   =================================================== */

const Nav = (() => {
  const pages = [
    { label: 'Dashboard', href: 'index.html', icon: 'dashboard' },
    { label: 'Timetable', href: 'timetable.html', icon: 'calendar_month' },
    { label: 'Focus', href: 'focus.html', icon: 'timer' },
    { label: 'Analytics', href: 'analytics.html', icon: 'analytics' },
    { label: 'Flashcards', href: 'flashcards.html', icon: 'style' },
    { label: 'Assistant', href: 'chatbot.html', icon: 'smart_toy' }
  ];

  const sideItems = [
    { label: 'Current Session', icon: 'play_circle', id: 'side-session', href: 'index.html' },
    { label: 'Study Timer', icon: 'timer', id: 'side-timer', href: 'focus.html' },
    { label: 'Resource Vault', icon: 'menu_book', id: 'side-vault', href: 'flashcards.html' },
    { label: 'Peer Group', icon: 'groups', id: 'side-peers', href: 'analytics.html' },
    { label: 'Notes', icon: 'edit_note', id: 'side-notes', href: 'timetable.html' }
  ];

  function currentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path;
  }

  function renderTopNav() {
    const cur = currentPage();
    const streak = Store.getStreak();
    const points = Store.getPoints();

    return `
    <nav id="top-nav" class="flex justify-between items-center w-full px-6 md:px-12 h-20 sticky top-0 z-50 bg-[#0d0b3d]/80 backdrop-blur-xl shadow-[0_20px_40px_-15px_rgba(13,11,61,0.6)]">
      <a href="index.html" class="text-2xl font-black text-[#a4c9ff] tracking-tighter flex items-center gap-2">
        <span class="material-symbols-outlined text-3xl" style="font-variation-settings:'FILL'1">school</span>
        Scholarly
      </a>
      <div class="hidden md:flex items-center gap-6 h-full">
        ${pages.map(p => `
          <a href="${p.href}" class="${cur === p.href
            ? 'text-[#a4c9ff] border-b-4 border-[#a4c9ff] pb-1'
            : 'text-[#c7c5d3] opacity-80 hover:text-[#a4c9ff] hover:opacity-100'
          } font-['Manrope'] tracking-tight font-semibold transition-all active:scale-95 duration-200 h-full flex items-center text-sm">${p.label}</a>
        `).join('')}
      </div>
      <div class="flex items-center gap-4">
        <div class="hidden lg:flex items-center gap-3 bg-surface-container-lowest/60 px-4 py-2 rounded-full">
          <span class="material-symbols-outlined text-sm text-tertiary" style="font-variation-settings:'FILL'1">local_fire_department</span>
          <span class="text-xs font-bold text-tertiary">${streak.count}d</span>
          <span class="w-px h-4 bg-outline-variant/30"></span>
          <span class="material-symbols-outlined text-sm text-primary" style="font-variation-settings:'FILL'1">stars</span>
          <span class="text-xs font-bold text-primary">${points.toLocaleString()}</span>
        </div>
        <button class="material-symbols-outlined text-[#a4c9ff] active:scale-95 duration-200 hidden md:block">notifications</button>
        <button class="material-symbols-outlined text-[#a4c9ff] active:scale-95 duration-200 hidden md:block">settings</button>
        <div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center border border-primary/20 overflow-hidden">
          <span class="material-symbols-outlined text-primary" style="font-variation-settings:'FILL'1">person</span>
        </div>
        <!-- Mobile menu toggle -->
        <button id="mobile-menu-btn" class="md:hidden material-symbols-outlined text-[#a4c9ff] text-2xl">menu</button>
      </div>
    </nav>
    <!-- Mobile menu -->
    <div id="mobile-menu" class="hidden md:hidden fixed inset-0 top-20 z-50 bg-[#0d0b3d]/95 backdrop-blur-xl p-6">
      <div class="flex flex-col gap-2">
        ${pages.map(p => `
          <a href="${p.href}" class="flex items-center gap-4 px-6 py-4 rounded-lg ${cur === p.href ? 'bg-[#2f2f60] text-[#a4c9ff]' : 'text-[#c7c5d3] hover:bg-[#2f2f60]/50'} font-semibold transition-all">
            <span class="material-symbols-outlined">${p.icon}</span>
            ${p.label}
          </a>
        `).join('')}
      </div>
    </div>`;
  }

  function renderSidebar(activeId) {
    const settings = Store.getSettings();
    return `
    <aside id="sidebar" class="fixed left-0 top-20 bottom-0 flex-col z-40 bg-[#161545] shadow-[40px_0_40px_-20px_rgba(13,11,61,0.5)] w-72 hidden md:flex">
      <div class="p-8 border-b border-outline-variant/10">
        <div class="flex items-center gap-3 mb-1">
          <span class="w-2 h-2 rounded-full bg-tertiary"></span>
          <h3 class="text-xs font-['Manrope'] uppercase tracking-widest text-[#a4c9ff] font-bold">Session Control</h3>
        </div>
        <p class="text-on-surface-variant text-xs">${settings.subjects[0] || 'No subject selected'}</p>
      </div>
      <nav class="flex-1 py-4 overflow-y-auto">
        ${sideItems.map(item => `
          <a href="${item.href}" id="${item.id}"
             class="${activeId === item.id
               ? 'bg-[#2f2f60] text-[#a4c9ff] border-l-4 border-[#a4c9ff] font-bold'
               : 'text-[#c7c5d3] hover:bg-[#2f2f60]/50'
             } px-6 py-4 flex items-center gap-4 font-['Manrope'] text-sm uppercase tracking-widest transition-colors cursor-pointer active:translate-x-1 duration-150 block">
            <span class="material-symbols-outlined">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="p-6 mt-auto">
        <a href="chatbot.html" class="text-[#c7c5d3] px-2 py-3 flex items-center gap-4 font-['Manrope'] text-sm uppercase tracking-widest hover:text-[#a4c9ff] transition-colors cursor-pointer mb-3">
          <span class="material-symbols-outlined">smart_toy</span>
          <span>Study Assistant</span>
        </a>
        <a href="index.html" class="text-[#c7c5d3] px-2 py-3 flex items-center gap-4 font-['Manrope'] text-sm uppercase tracking-widest hover:text-[#a4c9ff] transition-colors cursor-pointer mb-4">
          <span class="material-symbols-outlined">help</span>
          <span>Help Center</span>
        </a>
        <button onclick="Nav.endSession()" class="w-full py-3 bg-error-container text-error rounded-lg text-sm font-bold tracking-wider hover:bg-error-container/80 transition-all active:scale-95">
          End Session
        </button>
      </div>
    </aside>`;
  }

  function init(sidebarActiveId) {
    // Inject top nav
    const topTarget = document.getElementById('nav-mount');
    if (topTarget) topTarget.innerHTML = renderTopNav();

    // Inject sidebar
    const sideTarget = document.getElementById('sidebar-mount');
    if (sideTarget) sideTarget.innerHTML = renderSidebar(sidebarActiveId || 'side-session');

    // Mobile menu toggle
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    if (btn && menu) {
      btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
        btn.textContent = menu.classList.contains('hidden') ? 'menu' : 'close';
      });
    }

    // Update streak on every page load
    Store.updateStreak();
  }

  function endSession() {
    showToast('Session ended. Great work!', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  }

  // ---------- Toast utility ----------
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  return { init, showToast, endSession, currentPage };
})();
