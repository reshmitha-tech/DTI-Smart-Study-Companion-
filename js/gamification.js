/* ===================================================
   gamification.js — Points, Streaks & Achievements
   =================================================== */

const Gamification = (() => {
  const ACHIEVEMENTS = [
    { id: 'first_session', title: 'First Steps', desc: 'Complete your first study session', icon: 'rocket_launch', check: () => Store.getStudySessions().length >= 1 },
    { id: 'streak_3', title: 'Consistency Seeker', desc: '3-day study streak', icon: 'local_fire_department', check: () => Store.getStreak().count >= 3 },
    { id: 'streak_7', title: 'Week Warrior', desc: '7-day study streak', icon: 'military_tech', check: () => Store.getStreak().count >= 7 },
    { id: 'streak_14', title: 'Iron Will', desc: '14-day study streak', icon: 'shield', check: () => Store.getStreak().count >= 14 },
    { id: 'points_500', title: 'Scholar Apprentice', desc: 'Earn 500 points', icon: 'stars', check: () => Store.getPoints() >= 500 },
    { id: 'points_2000', title: 'Knowledge Seeker', desc: 'Earn 2,000 points', icon: 'emoji_events', check: () => Store.getPoints() >= 2000 },
    { id: 'points_5000', title: 'Master Scholar', desc: 'Earn 5,000 points', icon: 'workspace_premium', check: () => Store.getPoints() >= 5000 },
    { id: 'cards_50', title: 'Flashcard Pro', desc: 'Study 50 flashcards', icon: 'style', check: () => { const s = Store.getStudySessions(); return s.filter(x => x.type === 'flashcard').reduce((sum, x) => sum + (x.cards || 0), 0) >= 50; }},
    { id: 'focus_60', title: 'Deep Focus', desc: 'Complete a 60-min focus session', icon: 'psychology', check: () => Store.getStudySessions().some(s => s.duration >= 60) },
    { id: 'sessions_10', title: 'Dedicated Learner', desc: 'Complete 10 sessions', icon: 'school', check: () => Store.getStudySessions().length >= 10 }
  ];

  // Award points for finishing a study session
  function awardSession(durationMinutes) {
    const base = durationMinutes * 10; // 10 pts / min
    const bonus = durationMinutes >= 25 ? 50 : 0; // Pomodoro bonus
    const total = base + bonus;
    Store.addPoints(total);
    Store.updateStreak();
    checkAchievements();
    return total;
  }

  // Award points for flashcard study
  function awardFlashcards(cardCount) {
    const total = cardCount * 5;
    Store.addPoints(total);
    checkAchievements();
    return total;
  }

  // Check and unlock any newly earned achievements
  function checkAchievements() {
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach(ach => {
      if (ach.check()) {
        const isNew = Store.unlockAchievement({ id: ach.id, title: ach.title, desc: ach.desc, icon: ach.icon });
        if (isNew) newlyUnlocked.push(ach);
      }
    });
    // Show toast for new achievements
    newlyUnlocked.forEach(ach => {
      setTimeout(() => {
        Nav.showToast(`🏆 Achievement Unlocked: ${ach.title}!`, 'success');
      }, 500);
    });
    return newlyUnlocked;
  }

  function getAllAchievements() { return ACHIEVEMENTS; }

  return { awardSession, awardFlashcards, checkAchievements, getAllAchievements, ACHIEVEMENTS };
})();
