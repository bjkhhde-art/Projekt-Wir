const SUPABASE_URL = "https://lrzgcqoqcwicpuuuhaoj.supabase.co";
const SUPABASE_KEY = "sb_publishable_uunR3UQ9rttiK8dG85IedQ__Tn1duVK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const QUESTION_GROUPS = {
  easy: {
    label: "🧊 Easy Talk",
    categories: ["Eisbrecher", "Alltag", "Spaß & Spiel", "Hypothetisch"]
  },
  deep: {
    label: "💗 Deep Talk",
    categories: [
      "Tiefgründig",
      "Vergangenheit",
      "Persönlichkeit",
      "Werte",
      "Dankbarkeit",
      "Reflexion"
    ]
  },
  relationship: {
    label: "💑 Beziehung",
    categories: [
      "Beziehung",
      "Kommunikation",
      "Konflikte",
      "Intimität",
      "Träume & Ziele",
      "Zukunft",
      "Familie",
      "Finanzen"
    ]
  },
  sexy: {
    label: "🔥 Sexy Time",
    categories: ["Sexy", "Sexy Vertieft"]
  }
};

const categoryButtons = document.querySelectorAll(".category-btn");
const questionGroupLabel = document.getElementById("questionGroupLabel");
const questionRealCategory = document.getElementById("questionRealCategory");
const questionText = document.getElementById("questionText");
const questionCounter = document.getElementById("questionCounter");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const resetSeenBtn = document.getElementById("resetSeenBtn");

let currentGroupKey = "easy";
let currentQuestions = [];

async function loadQuestionsForGroup(groupKey) {
  currentGroupKey = groupKey;

  const group = QUESTION_GROUPS[groupKey];

  questionGroupLabel.textContent = group.label;
  questionRealCategory.textContent = "";
  questionText.textContent = "Lade Fragen...";
  questionCounter.textContent = "";

  const { data, error } = await supabaseClient
    .from("questions")
    .select("id, category, question, active")
    .in("category", group.categories);

  if (error) {
    console.error("Fehler beim Laden der Fragen:", error);
    questionText.textContent = "Fragen konnten nicht geladen werden.";
    return;
  }

  currentQuestions = data.filter(question => question.active !== false);

  showRandomQuestion();
}

function showRandomQuestion() {
  if (currentQuestions.length === 0) {
    questionText.textContent = "Keine Fragen in dieser Kategorie gefunden.";
    questionRealCategory.textContent = "";
    questionCounter.textContent = "";
    return;
  }

  const seenIds = getSeenIds(currentGroupKey);

  let availableQuestions = currentQuestions.filter(question => {
    return !seenIds.includes(question.id);
  });

  if (availableQuestions.length === 0) {
    clearSeenIds(currentGroupKey);
    availableQuestions = currentQuestions;
  }

  const randomIndex = Math.floor(Math.random() * availableQuestions.length);
  const selectedQuestion = availableQuestions[randomIndex];

  markQuestionAsSeen(currentGroupKey, selectedQuestion.id);

  questionText.textContent = selectedQuestion.question;
  questionRealCategory.textContent = selectedQuestion.category;

  updateCounter();
}

function updateCounter() {
  const seenIds = getSeenIds(currentGroupKey);
  const seenInCurrentGroup = currentQuestions.filter(question => {
    return seenIds.includes(question.id);
  }).length;

  questionCounter.textContent =
    `${seenInCurrentGroup} / ${currentQuestions.length} Fragen in dieser Kategorie gesehen`;
}

function getSeenIds(groupKey) {
  const storageKey = getStorageKey(groupKey);
  return JSON.parse(localStorage.getItem(storageKey)) || [];
}

function markQuestionAsSeen(groupKey, questionId) {
  const seenIds = getSeenIds(groupKey);

  if (!seenIds.includes(questionId)) {
    seenIds.push(questionId);
  }

  localStorage.setItem(getStorageKey(groupKey), JSON.stringify(seenIds));
}

function clearSeenIds(groupKey) {
  localStorage.removeItem(getStorageKey(groupKey));
}

function getStorageKey(groupKey) {
  return `questions_seen_${groupKey}`;
}

function setActiveButton(groupKey) {
  categoryButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.group === groupKey);
  });
}

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    const groupKey = button.dataset.group;
    setActiveButton(groupKey);
    loadQuestionsForGroup(groupKey);
  });
});

newQuestionBtn.addEventListener("click", () => {
  showRandomQuestion();
});

resetSeenBtn.addEventListener("click", () => {
  clearSeenIds(currentGroupKey);
  showRandomQuestion();
});

loadQuestionsForGroup(currentGroupKey);
