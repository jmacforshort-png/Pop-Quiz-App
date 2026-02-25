const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const params = new URLSearchParams(window.location.search);
const quizId = params.get("quizId");

const titleText = document.getElementById("student-quiz-title");
const descriptionText = document.getElementById("student-quiz-description");
const questionWrap = document.getElementById("student-quiz-questions");
const submitButton = document.getElementById("submit-student-quiz");
const messageText = document.getElementById("student-quiz-message");

let loadedQuiz = null;

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function renderQuiz(quiz) {
  loadedQuiz = quiz;
  titleText.textContent = quiz.title;
  descriptionText.textContent = quiz.description || "";

  questionWrap.innerHTML = "";

  quiz.questions.forEach((question, index) => {
    const card = document.createElement("section");
    card.className = "question-card";

    const heading = document.createElement("h3");
    heading.textContent = `Question ${index + 1}`;

    const prompt = document.createElement("p");
    prompt.textContent = question.prompt;

    const choices = document.createElement("div");
    choices.className = "choice-grid";

    question.choices.forEach((choice) => {
      const label = document.createElement("label");
      label.className = "student-choice";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `question_${question.id}`;
      input.value = choice.label;
      input.dataset.questionId = question.id;

      const text = document.createElement("span");
      text.textContent = `${choice.label}. ${choice.text}`;

      label.append(input, text);
      choices.appendChild(label);
    });

    card.append(heading, prompt, choices);
    questionWrap.appendChild(card);
  });
}

function collectAnswers() {
  if (!loadedQuiz) {
    return null;
  }

  const answers = loadedQuiz.questions.map((question) => {
    const selected = document.querySelector(`input[name="question_${question.id}"]:checked`);
    return {
      questionId: question.id,
      selectedLabel: selected ? selected.value : null,
    };
  });

  if (answers.some((answer) => !answer.selectedLabel)) {
    return null;
  }

  return answers;
}

async function loadQuiz() {
  if (!quizId) {
    setMessage("Missing quiz ID in URL.", true);
    submitButton.disabled = true;
    return;
  }

  setMessage("Loading quiz...");

  const response = await fetch(`${API_BASE}/student/quizzes/${quizId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    setMessage("Unable to load this quiz.", true);
    submitButton.disabled = true;
    return;
  }

  const data = await response.json();
  renderQuiz(data.quiz);
  submitButton.disabled = false;
  setMessage("");
}

submitButton.addEventListener("click", async () => {
  const answers = collectAnswers();
  if (!answers) {
    setMessage("Answer every question before submitting.", true);
    return;
  }

  submitButton.disabled = true;
  setMessage("Submitting quiz...");

  const response = await fetch(`${API_BASE}/student/quizzes/${quizId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ answers }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to submit quiz.", true);
    submitButton.disabled = false;
    return;
  }

  const data = await response.json();
  setMessage(`Quiz submitted. Score saved: ${data.attempt.score}/${data.attempt.maxScore}.`);
});

loadQuiz();
