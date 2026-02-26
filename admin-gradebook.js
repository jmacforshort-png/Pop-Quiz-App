const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const classFilter = document.getElementById("gradebook-class-filter");
const quizFilter = document.getElementById("gradebook-quiz-filter");
const weekStartInput = document.getElementById("gradebook-week-start");
const refreshButton = document.getElementById("gradebook-refresh");
const exportButton = document.getElementById("gradebook-export");
const messageText = document.getElementById("gradebook-message");
const emptyState = document.getElementById("gradebook-empty");
const table = document.getElementById("gradebook-table");
const tableBody = document.getElementById("gradebook-table-body");
const logoutButton = document.getElementById("admin-logout");

let rowsCache = [];
let sortState = {
  key: "username",
  direction: "asc",
};

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function buildQueryParams() {
  const params = new URLSearchParams();
  if (classFilter.value) {
    params.set("classId", classFilter.value);
  }
  if (quizFilter.value) {
    params.set("quizId", quizFilter.value);
  }
  if (weekStartInput.value) {
    params.set("weekStart", weekStartInput.value);
  }
  return params;
}

function compareRows(left, right, key, direction) {
  const modifier = direction === "asc" ? 1 : -1;
  if (key === "score") {
    return ((left.score ?? -1) - (right.score ?? -1)) * modifier;
  }

  if (key === "submittedAt") {
    return (
      ((new Date(left.submittedAt || 0).getTime() || 0) -
        (new Date(right.submittedAt || 0).getTime() || 0)) *
      modifier
    );
  }

  return left[key].localeCompare(right[key]) * modifier;
}

function sortRows(rows) {
  return [...rows].sort((left, right) =>
    compareRows(left, right, sortState.key, sortState.direction)
  );
}

function renderRows(rows) {
  tableBody.innerHTML = "";

  if (!rows.length) {
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const percentText = row.percent === null ? "-" : `${row.percent.toFixed(2)}%`;

    tr.innerHTML = `
      <td>${row.username}</td>
      <td>${row.className}</td>
      <td>${row.blockNumber}</td>
      <td>${row.quizTitle}</td>
      <td>${row.status}</td>
      <td>${row.score === null ? "-" : `${row.score}/${row.maxScore}`}</td>
      <td>${percentText}</td>
      <td>${formatDate(row.submittedAt)}</td>
      <td>${row.late ? "Yes" : "No"}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function loadFilters() {
  const [classesResponse, quizzesResponse] = await Promise.all([
    fetch(`${API_BASE}/admin/classes`, { credentials: "include" }),
    fetch(`${API_BASE}/admin/quizzes`, { credentials: "include" }),
  ]);

  if (!classesResponse.ok || !quizzesResponse.ok) {
    setMessage("Unable to load gradebook filters.", true);
    return;
  }

  const classPayload = await classesResponse.json();
  const quizPayload = await quizzesResponse.json();

  classFilter.innerHTML = '<option value="">All classes</option>';
  (classPayload.classes || []).forEach((classItem) => {
    const option = document.createElement("option");
    option.value = classItem.id;
    option.textContent = `${classItem.name} (Block ${classItem.blockNumber})`;
    classFilter.appendChild(option);
  });

  quizFilter.innerHTML = '<option value="">All quizzes</option>';
  (quizPayload.quizzes || []).forEach((quiz) => {
    const option = document.createElement("option");
    option.value = quiz.id;
    option.textContent = quiz.title;
    quizFilter.appendChild(option);
  });
}

async function loadGradebookRows() {
  setMessage("Loading gradebook...");
  const query = buildQueryParams().toString();
  const url = query
    ? `${API_BASE}/admin/reports/gradebook?${query}`
    : `${API_BASE}/admin/reports/gradebook`;

  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to load gradebook report.", true);
    renderRows([]);
    return;
  }

  const payload = await response.json();
  rowsCache = payload.rows || [];
  renderRows(sortRows(rowsCache));
  setMessage("");
}

function exportCsv() {
  const query = buildQueryParams().toString();
  const url = query
    ? `${API_BASE}/admin/reports/gradebook/export.csv?${query}`
    : `${API_BASE}/admin/reports/gradebook/export.csv`;
  window.open(url, "_blank");
}

refreshButton.addEventListener("click", async () => {
  await loadGradebookRows();
});

classFilter.addEventListener("change", async () => {
  await loadGradebookRows();
});

quizFilter.addEventListener("change", async () => {
  await loadGradebookRows();
});

weekStartInput.addEventListener("change", async () => {
  await loadGradebookRows();
});

exportButton.addEventListener("click", () => {
  exportCsv();
});

document.querySelectorAll(".table-sort").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.sortKey;
    if (!key) {
      return;
    }

    if (sortState.key === key) {
      sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    } else {
      sortState.key = key;
      sortState.direction = "asc";
    }

    renderRows(sortRows(rowsCache));
  });
});

logoutButton?.addEventListener("click", async () => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "index.html";
});

loadFilters().then(loadGradebookRows);
