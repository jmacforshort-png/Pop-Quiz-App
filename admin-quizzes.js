const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const quizForm = document.getElementById("quiz-form");
const quizTitleInput = document.getElementById("quiz-title");
const quizDescriptionInput = document.getElementById("quiz-description");
const questionCards = document.getElementById("question-cards");
const quizMessage = document.getElementById("quiz-message");

const CHOICE_LABELS = ["A", "B", "C", "D"];
const QUESTION_COUNT = 5;

function setMessage(text, isError = false) {
  quizMessage.textContent = text;
  quizMessage.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function renderQuestionCards() {
  questionCards.innerHTML = "";

  for (let index = 1; index <= QUESTION_COUNT; index += 1) {
    const card = document.createElement("section");
    card.className = "question-card";

    const title = document.createElement("h3");
    title.textContent = `Question ${index}`;

    const promptInput = document.createElement("textarea");
    promptInput.rows = 2;
    promptInput.required = true;
    promptInput.placeholder = "Question prompt";
    promptInput.dataset.role = "prompt";

    const choicesWrap = document.createElement("div");
    choicesWrap.className = "choice-grid";

    CHOICE_LABELS.forEach((label) => {
      const choiceLabel = document.createElement("label");
      choiceLabel.textContent = `Answer ${label}`;

      const input = document.createElement("input");
      input.type = "text";
      input.required = true;
      input.placeholder = `Choice ${label}`;
      input.dataset.role = "choice";
      input.dataset.choiceLabel = label;

      choiceLabel.appendChild(input);
      choicesWrap.appendChild(choiceLabel);
    });

    const keyLabel = document.createElement("label");
    keyLabel.textContent = "Correct Answer";

    const keySelect = document.createElement("select");
    keySelect.required = true;
    keySelect.dataset.role = "answerKey";

    CHOICE_LABELS.forEach((label) => {
      const option = document.createElement("option");
      option.value = label;
      option.textContent = label;
      keySelect.appendChild(option);
    });

    keyLabel.appendChild(keySelect);

    card.append(title, promptInput, choicesWrap, keyLabel);
    questionCards.appendChild(card);
  }
}

function buildQuizPayload() {
  const cards = Array.from(document.querySelectorAll(".question-card"));

  return {
    title: quizTitleInput.value,
    description: quizDescriptionInput.value || undefined,
    questions: cards.map((card) => {
      const prompt = card.querySelector('[data-role="prompt"]').value;
      const answerKey = card.querySelector('[data-role="answerKey"]').value;
      const choices = Array.from(card.querySelectorAll('[data-role="choice"]')).map((input) => ({
        label: input.dataset.choiceLabel,
        text: input.value,
        isCorrect: input.dataset.choiceLabel === answerKey,
      }));

      return {
        prompt,
        choices,
      };
    }),
  };
}

quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Saving quiz draft...");

  const response = await fetch(`${API_BASE}/admin/quizzes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(buildQuizPayload()),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to save quiz draft.", true);
    return;
  }

  quizForm.reset();
  renderQuestionCards();
  setMessage("Quiz draft saved.");
});

renderQuestionCards();
