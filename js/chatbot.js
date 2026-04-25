/* ===================================================
   chatbot.js — Study Assistant (Flask API backed)
   =================================================== */

const Chatbot = (() => {

  // Call Flask backend for responses
  async function getResponse(userMessage) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      const data = await res.json();
      return data.response;
    } catch (e) {
      // Fallback to local if server is unavailable
      return _localResponse(userMessage);
    }
  }

  // Fallback local matching
  function _localResponse(msg) {
    msg = msg.toLowerCase().trim();
    const tips = {
      study: [
        "Use the Pomodoro technique: study for 25 minutes, then take a 5-minute break.",
        "Active recall is more effective than re-reading. Close your book and try to write down everything you remember.",
        "Teach the material to someone else. This Feynman Technique reveals gaps in your understanding.",
        "Use spaced repetition: review material at increasing intervals (1 day, 3 days, 7 days, 14 days)."
      ],
      focus: [
        "Put your phone in another room during study sessions. Out of sight, out of mind.",
        "Create a dedicated study environment — your brain associates locations with activities.",
        "Use our Laptop Mode in the Focus Timer! It detects when you switch tabs.",
        "Try background white noise or lo-fi music. Avoid music with lyrics."
      ],
      revision: [
        "Create flashcards for key concepts using our Flashcards feature with spaced repetition!",
        "Practice past papers under timed conditions to build exam stamina.",
        "Use the blurting method: write everything you know from memory, then check for gaps.",
        "Review notes within 24 hours — the optimal point on the forgetting curve."
      ],
      motivation: [
        "Remember: 'The expert in anything was once a beginner.' You're making progress!",
        "'Small progress is still progress.' Every minute studied counts.",
        "You don't have to feel motivated to start. Start anyway — motivation follows action.",
        "Track your streak! Consistency beats intensity every time."
      ]
    };
    const keywords = {
      study: ['study', 'learn', 'technique', 'tips', 'how to', 'improve', 'better', 'advice', 'help'],
      focus: ['focus', 'concentrate', 'distract', 'attention', 'phone', 'procrastinate', 'lazy', 'tab'],
      revision: ['revise', 'exam', 'test', 'flashcard', 'prepare', 'review', 'grade', 'paper', 'quiz'],
      motivation: ['motivat', 'inspire', 'give up', 'hard', 'difficult', 'stress', 'struggle', 'can\'t', 'fail', 'tired']
    };

    let best = null, bestScore = 0;
    for (const [cat, kws] of Object.entries(keywords)) {
      const score = kws.filter(kw => msg.includes(kw)).length;
      if (score > bestScore) { bestScore = score; best = cat; }
    }
    if (best && bestScore > 0) return tips[best][Math.floor(Math.random() * tips[best].length)];
    return "I can help with study tips, focus advice, revision strategies, and motivation. Try asking something like 'How do I focus better?' or 'Give me study tips'!";
  }

  async function getGreeting() {
    try {
      const res = await fetch('/api/greeting');
      const data = await res.json();
      return data.response;
    } catch (e) {
      return "Hello! 👋 I'm your Scholarly Study Assistant. Ask me about study tips, focus strategies, revision techniques, or motivation!";
    }
  }

  function getQuickActions() {
    return [
      { label: '📚 Study Tips', message: 'Give me effective study tips and techniques' },
      { label: '🎯 Focus Help', message: 'How do I focus better and avoid distractions?' },
      { label: '📝 Revision Strategy', message: 'What are the best revision strategies for exams?' },
      { label: '💪 Motivation', message: 'I need some motivation to keep studying' }
    ];
  }

  return { getResponse, getQuickActions, getGreeting };
})();
