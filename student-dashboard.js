const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const refreshButton = document.getElementById("refresh-student");
const messageText = document.getElementById("student-message");
const emptyState = document.getElementById("student-empty");
const listContainer = document.getElementById("student-list");
const upcomingEmptyState = document.getElementById("student-upcoming-empty");
const upcomingListContainer = document.getElementById("student-upcoming-list");
const closedEmptyState = document.getElementById("student-closed-empty");
const closedListContainer = document.getElementById("student-closed-list");
const resultsEmptyState = document.getElementById("student-results-empty");
const resultsListContainer = document.getElementById("student-results-list");
const logoutButton = document.getElementById("student-logout");

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

function renderQuizItems(container, emptyNode, quizzes, status) {
  container.innerHTML = "";
  if (!quizzes.length) {
    container.hidden = true;
    emptyNode.hidden = false;
    return;
  }

  container.hidden = false;
  emptyNode.hidden = true;

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
    if (assignment?.class) {
      if (status === "available") {
        timing.textContent = `Available now for Block ${assignment.class.blockNumber} until ${formatDate(assignment.visibleUntilUtc)}.`;
      } else if (status === "upcoming") {
        timing.textContent = `Opens ${formatDate(assignment.visibleFromUtc)} for Block ${assignment.class.blockNumber}.`;
      } else {
        timing.textContent = `Closed ${formatDate(assignment.visibleUntilUtc)} for Block ${assignment.class.blockNumber}.`;
      }
    }

    if (status === "available") {
      const startLink = document.createElement("a");
      startLink.className = "btn primary";
      startLink.href = `student-quiz.html?quizId=${encodeURIComponent(quiz.id)}`;
      startLink.textContent = "Start Quiz";
      item.append(heading, description, timing, startLink);
    } else {
      item.append(heading, description, timing);
    }
    container.appendChild(item);
  });
}

function renderQuizzes(feed) {
  const available = feed.filter((quiz) => quiz.availabilityStatus === "available");
  const upcoming = feed.filter((quiz) => quiz.availabilityStatus === "upcoming");
  const closed = feed.filter((quiz) => quiz.availabilityStatus === "closed");
  renderQuizItems(listContainer, emptyState, available, "available");
  renderQuizItems(upcomingListContainer, upcomingEmptyState, upcoming, "upcoming");
  renderQuizItems(closedListContainer, closedEmptyState, closed, "closed");
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
      status.textContent = `Published score: ${result.score}/${result.maxScore}`;
    } else {
      status.textContent = "Pending result: Submitted, waiting for teacher to publish.";
    }

    item.append(heading, submitted, status);
    resultsListContainer.appendChild(item);
  });
}

async function loadStudentQuizzes() {
  setMessage("Loading quizzes...");

  const [feedResponse, resultsResponse] = await Promise.all([
    fetch(`${API_BASE}/student/quiz-feed`, {
      credentials: "include",
    }),
    fetch(`${API_BASE}/student/results`, {
      credentials: "include",
    }),
  ]);

  if (!feedResponse.ok || !resultsResponse.ok) {
    setMessage("Unable to load quizzes. Make sure you are logged in as a student.", true);
    renderQuizzes([]);
    renderResults([]);
    return;
  }

  const feedPayload = await feedResponse.json();
  const resultsPayload = await resultsResponse.json();
  renderQuizzes(feedPayload.feed || []);
  renderResults(resultsPayload.results || []);
  setMessage("");
}

refreshButton.addEventListener("click", async () => {
  await loadStudentQuizzes();
});

logoutButton?.addEventListener("click", async () => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "index.html";
});

loadStudentQuizzes();
