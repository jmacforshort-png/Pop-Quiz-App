const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const params = new URLSearchParams(window.location.search);
const quizId = params.get("quizId");

const titleText = document.getElementById("student-quiz-title");
const descriptionText = document.getElementById("student-quiz-description");
const questionWrap = document.getElementById("student-quiz-questions");
const submitButton = document.getElementById("submit-student-quiz");
const messageText = document.getElementById("student-quiz-message");
const windowMessage = document.getElementById("student-window-message");
const confirmationWrap = document.getElementById("submission-confirmation");
const confirmationText = document.getElementById("submission-confirmation-text");
const logoutButton = document.getElementById("student-logout");

let loadedQuiz = null;
let quizWindow = null;
let countdownTimerId = null;
let quizStartedAtIso = null;

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

function formatTimeRemaining(targetDate) {
  const remainingMs = targetDate.getTime() - Date.now();
  if (remainingMs <= 0) {
    return "0m 0s";
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function updateWindowMessage() {
  if (!quizWindow?.visibleUntilUtc) {
    windowMessage.textContent = "";
    return;
  }

  const until = new Date(quizWindow.visibleUntilUtc);
  const from = new Date(quizWindow.visibleFromUtc);
  if (Date.now() >= until.getTime()) {
    windowMessage.textContent = `This quiz window is closed (ended ${formatDate(until)}).`;
    submitButton.disabled = true;
    return;
  }

  windowMessage.textContent = `Quiz open from ${formatDate(from)} to ${formatDate(until)}. Time remaining: ${formatTimeRemaining(until)}.`;
}

function showSubmissionConfirmation(attempt) {
  const submittedAt = formatDate(attempt.submittedAt);
  if (attempt.resultStatus === "published" && attempt.score !== null) {
    confirmationText.textContent = `Submitted ${submittedAt}. Published score: ${attempt.score}/${attempt.maxScore}.`;
  } else {
    confirmationText.textContent = `Submitted ${submittedAt}. Status: pending result (teacher has not published scores yet).`;
  }
  confirmationWrap.hidden = false;
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
  quizStartedAtIso = new Date().toISOString();
  const feedResponse = await fetch(`${API_BASE}/student/quiz-feed`, { credentials: "include" });
  if (feedResponse.ok) {
    const feedData = await feedResponse.json();
    const feedQuiz = (feedData.feed || []).find((item) => item.id === quizId);
    if (feedQuiz?.assignment) {
      quizWindow = {
        visibleFromUtc: feedQuiz.assignment.visibleFromUtc,
        visibleUntilUtc: feedQuiz.assignment.visibleUntilUtc,
      };
      updateWindowMessage();
      if (countdownTimerId) {
        window.clearInterval(countdownTimerId);
      }
      countdownTimerId = window.setInterval(updateWindowMessage, 1000);
    }
  }
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
    body: JSON.stringify({ answers, startedAt: quizStartedAtIso }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to submit quiz.", true);
    submitButton.disabled = false;
    return;
  }

  const data = await response.json();
  showSubmissionConfirmation(data.attempt);
  submitButton.disabled = true;
  if (data.attempt.resultStatus === "published" && data.attempt.score !== null) {
    setMessage(`Quiz submitted. Published score: ${data.attempt.score}/${data.attempt.maxScore}.`);
    return;
  }

  setMessage("Quiz submitted. Result is pending until your teacher publishes scores.");
});

logoutButton?.addEventListener("click", async () => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "index.html";
});

window.addEventListener("beforeunload", () => {
  if (countdownTimerId) {
    window.clearInterval(countdownTimerId);
  }
});

loadQuiz();
