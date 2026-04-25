/* ===================================================
   flashcards.js — Deck Management & Spaced Repetition
   =================================================== */

const Flashcards = (() => {
  let currentDeckId = null;
  let currentCardIndex = 0;
  let isFlipped = false;
  let sessionStats = { correct: 0, hard: 0, easy: 0, total: 0 };

  function createDeck(name, subject) {
    const deck = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      name,
      subject: subject || 'General',
      cards: [],
      createdAt: new Date().toISOString()
    };
    Store.saveDeck(deck);
    return deck;
  }

  function addCard(deckId, front, back) {
    const decks = Store.getDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return null;
    const card = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      front,
      back,
      difficulty: 0, // 0=unseen, 1=hard, 2=good, 3=easy
      nextReview: new Date().toISOString(),
      reviewCount: 0
    };
    deck.cards.push(card);
    Store.saveDeck(deck);
    return card;
  }

  function removeCard(deckId, cardId) {
    const decks = Store.getDecks();
    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;
    deck.cards = deck.cards.filter(c => c.id !== cardId);
    Store.saveDeck(deck);
  }

  function startSession(deckId) {
    currentDeckId = deckId;
    currentCardIndex = 0;
    isFlipped = false;
    sessionStats = { correct: 0, hard: 0, easy: 0, total: 0 };

    // Sort cards: due for review first, then unseen
    const deck = getDeck(deckId);
    if (deck) {
      const now = new Date();
      deck.cards.sort((a, b) => {
        const aDue = new Date(a.nextReview) <= now;
        const bDue = new Date(b.nextReview) <= now;
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        return a.reviewCount - b.reviewCount;
      });
      Store.saveDeck(deck);
    }
    return deck;
  }

  function getCurrentCard() {
    const deck = getDeck(currentDeckId);
    if (!deck || currentCardIndex >= deck.cards.length) return null;
    return deck.cards[currentCardIndex];
  }

  function flipCard() {
    isFlipped = !isFlipped;
    return isFlipped;
  }

  function rateCard(rating) {
    // rating: 'hard', 'good', 'easy'
    const deck = getDeck(currentDeckId);
    if (!deck) return;
    const card = deck.cards[currentCardIndex];
    if (!card) return;

    card.reviewCount++;
    const now = new Date();
    switch (rating) {
      case 'hard':
        card.difficulty = 1;
        card.nextReview = new Date(now.getTime() + 1 * 60000).toISOString(); // 1 min
        sessionStats.hard++;
        break;
      case 'good':
        card.difficulty = 2;
        card.nextReview = new Date(now.getTime() + 24 * 3600000).toISOString(); // 1 day
        sessionStats.correct++;
        break;
      case 'easy':
        card.difficulty = 3;
        card.nextReview = new Date(now.getTime() + 4 * 24 * 3600000).toISOString(); // 4 days
        sessionStats.easy++;
        break;
    }
    sessionStats.total++;
    Store.saveDeck(deck);

    // Move to next card
    currentCardIndex++;
    isFlipped = false;

    return {
      hasNext: currentCardIndex < deck.cards.length,
      progress: currentCardIndex,
      total: deck.cards.length,
      stats: { ...sessionStats }
    };
  }

  function finishSession() {
    const deck = getDeck(currentDeckId);
    if (deck && sessionStats.total > 0) {
      const points = Gamification.awardFlashcards(sessionStats.total);
      Store.addStudySession({
        subject: deck.subject || deck.name,
        duration: Math.max(1, Math.floor(sessionStats.total * 0.5)),
        mode: 'flashcard',
        points,
        type: 'flashcard',
        cards: sessionStats.total
      });
      Store.updateDailyGoal(Math.max(1, Math.floor(sessionStats.total * 0.5)));
    }
    const result = { ...sessionStats, deckName: deck?.name };
    sessionStats = { correct: 0, hard: 0, easy: 0, total: 0 };
    currentDeckId = null;
    currentCardIndex = 0;
    isFlipped = false;
    return result;
  }

  function getDeck(id) {
    return Store.getDecks().find(d => d.id === id) || null;
  }

  function getRetentionRate(deckId) {
    const deck = getDeck(deckId);
    if (!deck || deck.cards.length === 0) return 0;
    const reviewed = deck.cards.filter(c => c.reviewCount > 0);
    if (reviewed.length === 0) return 0;
    const good = reviewed.filter(c => c.difficulty >= 2).length;
    return Math.round((good / reviewed.length) * 100);
  }

  function getSessionProgress() {
    const deck = getDeck(currentDeckId);
    if (!deck) return { current: 0, total: 0, percent: 0 };
    return {
      current: currentCardIndex,
      total: deck.cards.length,
      percent: deck.cards.length > 0 ? Math.round((currentCardIndex / deck.cards.length) * 100) : 0
    };
  }

  function isCardFlipped() { return isFlipped; }

  // Seed demo decks if empty
  function seedDemoData() {
    if (Store.getDecks().length > 0) return;

    const deck1 = createDeck('The Renaissance Era', 'History');
    addCard(deck1.id, 'Who commissioned the ceiling of the Sistine Chapel, and which artist performed the work?', 'Pope Julius II commissioned the ceiling. Michelangelo painted it between 1508 and 1512.');
    addCard(deck1.id, 'What was the impact of the Printing Press on European literacy?', 'The Gutenberg printing press (c. 1440) dramatically increased book production, reducing costs and enabling widespread literacy and the spread of knowledge.');
    addCard(deck1.id, 'Who wrote "The Prince" and what was its main thesis?', 'Niccolò Machiavelli wrote "The Prince" (1532). It argued that effective rulers must be willing to act immorally when necessary to maintain power and stability.');
    addCard(deck1.id, 'What was the significance of the Medici family in the Renaissance?', 'The Medici were a wealthy banking family in Florence who became major patrons of art, architecture, and learning, helping to spark the Italian Renaissance.');
    addCard(deck1.id, 'Name three major Renaissance artists and one of their famous works.', 'Leonardo da Vinci (Mona Lisa), Michelangelo (David), Raphael (The School of Athens).');

    const deck2 = createDeck('Big O Notation', 'Computer Science');
    addCard(deck2.id, 'What is O(1) time complexity?', 'Constant time — the operation takes the same time regardless of input size. Example: accessing an array element by index.');
    addCard(deck2.id, 'What is O(n) time complexity?', 'Linear time — the time grows linearly with input size. Example: iterating through an array.');
    addCard(deck2.id, 'What is O(n²) time complexity?', 'Quadratic time — time grows proportionally to the square of input size. Example: nested loops over the same array (bubble sort).');
    addCard(deck2.id, 'What is O(log n) time complexity?', 'Logarithmic time — time grows logarithmically. Example: binary search on a sorted array.');
  }

  return {
    createDeck, addCard, removeCard, getDeck,
    startSession, getCurrentCard, flipCard, rateCard, finishSession,
    getRetentionRate, getSessionProgress, isCardFlipped,
    seedDemoData
  };
})();
