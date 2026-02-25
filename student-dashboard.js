const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const refreshButton = document.getElementById("refresh-student");
const messageText = document.getElementById("student-message");
const emptyState = document.getElementById("student-empty");
const listContainer = document.getElementById("student-list");

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
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

async function loadStudentQuizzes() {
  setMessage("Loading quizzes...");

  const response = await fetch(`${API_BASE}/student/quizzes`, {
    credentials: "include",
  });

  if (!response.ok) {
    setMessage("Unable to load quizzes. Make sure you are logged in as a student.", true);
    renderQuizzes([]);
    return;
  }

  const data = await response.json();
  renderQuizzes(data.quizzes || []);
  setMessage("");
}

refreshButton.addEventListener("click", async () => {
  await loadStudentQuizzes();
});

loadStudentQuizzes();
