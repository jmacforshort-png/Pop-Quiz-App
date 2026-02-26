const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const refreshButton = document.getElementById("refresh-student");
const messageText = document.getElementById("student-message");
const emptyState = document.getElementById("student-empty");
const listContainer = document.getElementById("student-list");
const resultsEmptyState = document.getElementById("student-results-empty");
const resultsListContainer = document.getElementById("student-results-list");

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function renderQuizzes(quizzes) {
  listContainer.innerHTML = "";

  if (!quizzes.length) {
    listContainer.hidden = true;
    emptyState.hidden = false;
    return;
  }

  listContainer.hidden = false;
  emptyState.hidden = true;

  quizzes.forEach((quiz) => {
    const item = document.createElement("article");
    item.className = "student-quiz-item";

    const heading = document.createElement("h3");
    heading.textContent = quiz.title;

    const description = document.createElement("p");
    description.textContent = quiz.description || "No description provided.";

    const assignment = quiz.assignments?.[0];
    const timing = document.createElement("p");
    timing.className = "subtitle";
    if (assignment) {
      timing.textContent = `Block ${assignment.class?.blockNumber}: ${formatDate(assignment.visibleFromUtc)} - ${formatDate(assignment.visibleUntilUtc)}`;
    }

    const startLink = document.createElement("a");
    startLink.className = "btn primary";
    startLink.href = `student-quiz.html?quizId=${encodeURIComponent(quiz.id)}`;
    startLink.textContent = "Start Quiz";

    item.append(heading, description, timing, startLink);
    listContainer.appendChild(item);
  });
}

function renderResults(results) {
  resultsListContainer.innerHTML = "";

  if (!results.length) {
    resultsListContainer.hidden = true;
    resultsEmptyState.hidden = false;
    return;
  }

  resultsListContainer.hidden = false;
  resultsEmptyState.hidden = true;

  results.forEach((result) => {
    const item = document.createElement("article");
    item.className = "student-quiz-item";

    const heading = document.createElement("h3");
    heading.textContent = result.quizTitle;

    const submitted = document.createElement("p");
    submitted.className = "subtitle";
    submitted.textContent = `Submitted: ${formatDate(result.submittedAt)}`;

    const status = document.createElement("p");
    status.className = "subtitle";
    if (result.resultStatus === "published" && result.score !== null) {
      status.textContent = `Score: ${result.score}/${result.maxScore}`;
    } else {
      status.textContent = "Result: Pending teacher release";
    }

    item.append(heading, submitted, status);
    resultsListContainer.appendChild(item);
  });
}

async function loadStudentQuizzes() {
  setMessage("Loading quizzes...");

  const [quizzesResponse, resultsResponse] = await Promise.all([
    fetch(`${API_BASE}/student/quizzes`, {
      credentials: "include",
    }),
    fetch(`${API_BASE}/student/results`, {
      credentials: "include",
    }),
  ]);

  if (!quizzesResponse.ok || !resultsResponse.ok) {
    setMessage("Unable to load quizzes. Make sure you are logged in as a student.", true);
    renderQuizzes([]);
    renderResults([]);
    return;
  }

  const quizzesPayload = await quizzesResponse.json();
  const resultsPayload = await resultsResponse.json();
  renderQuizzes(quizzesPayload.quizzes || []);
  renderResults(resultsPayload.results || []);
  setMessage("");
}

refreshButton.addEventListener("click", async () => {
  await loadStudentQuizzes();
});

loadStudentQuizzes();
