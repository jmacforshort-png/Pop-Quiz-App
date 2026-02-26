const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const quizForm = document.getElementById("quiz-form");
const quizTitleInput = document.getElementById("quiz-title");
const quizDescriptionInput = document.getElementById("quiz-description");
const assignmentList = document.getElementById("assignment-list");
const questionCards = document.getElementById("question-cards");
const quizMessage = document.getElementById("quiz-message");
const draftSelect = document.getElementById("draft-select");
const refreshQuizzesButton = document.getElementById("refresh-quizzes");
const newQuizButton = document.getElementById("new-quiz");
const publishQuizButton = document.getElementById("publish-quiz");
const quizListEmpty = document.getElementById("quiz-list-empty");
const quizListTable = document.getElementById("quiz-list-table");
const quizListBody = document.getElementById("quiz-list-body");
const refreshSummaryButton = document.getElementById("refresh-summary");
const summaryTodayActive = document.getElementById("summary-today-active");
const summaryTodayProgress = document.getElementById("summary-today-progress");
const summaryWeekActive = document.getElementById("summary-week-active");
const summaryWeekProgress = document.getElementById("summary-week-progress");
const summaryPublishEmpty = document.getElementById("summary-publish-empty");
const summaryPublishActions = document.getElementById("summary-publish-actions");
const reportBlockFilter = document.getElementById("report-block-filter");
const refreshReportButton = document.getElementById("refresh-report");
const reportEmpty = document.getElementById("report-empty");
const reportTable = document.getElementById("report-table");
const reportBody = document.getElementById("report-body");
const logoutButton = document.getElementById("admin-logout");

const CHOICE_LABELS = ["A", "B", "C", "D"];
const QUESTION_COUNT = 5;
const SCHEDULE_PRESETS = {
  custom: {
    label: "Custom",
    resolve: () => null,
  },
  blockPeriod: {
    label: "This block period (now + 50 min)",
    resolve: () => {
      const from = new Date();
      from.setSeconds(0, 0);
      const until = new Date(from.getTime() + 50 * 60000);
      return { from, until };
    },
  },
  todaySchool: {
    label: "Today 8:00 - 15:00",
    resolve: () => {
      const now = new Date();
      const from = new Date(now);
      from.setHours(8, 0, 0, 0);
      const until = new Date(now);
      until.setHours(15, 0, 0, 0);
      return { from, until };
    },
  },
  tomorrowSchool: {
    label: "Tomorrow 8:00 - 15:00",
    resolve: () => {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() + 1);
      from.setHours(8, 0, 0, 0);
      const until = new Date(from);
      until.setHours(15, 0, 0, 0);
      return { from, until };
    },
  },
};

let editingQuizId = null;
let cachedQuizzes = [];
let cachedClasses = [];

function syncActionState() {
  publishQuizButton.disabled = !editingQuizId;
}

function setMessage(text, isError = false) {
  quizMessage.textContent = text;
  quizMessage.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function toLocalDatetimeValue(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function toLocalDatetimeValueFromDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
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

function renderAssignments(classes) {
  assignmentList.innerHTML = "";

  if (!classes.length) {
    assignmentList.textContent = "No classes found. Create classes first in the Class Manager.";
    return;
  }

  classes.forEach((classItem) => {
    const row = document.createElement("div");
    row.className = "assignment-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.role = "assignment";
    checkbox.value = classItem.id;

    const text = document.createElement("span");
    text.textContent = `${classItem.name} (Block ${classItem.blockNumber})`;

    const fromLabel = document.createElement("label");
    fromLabel.textContent = "From";

    const fromInput = document.createElement("input");
    fromInput.type = "datetime-local";
    fromInput.dataset.role = "visibleFrom";
    fromInput.dataset.classId = classItem.id;
    fromLabel.appendChild(fromInput);

    const untilLabel = document.createElement("label");
    untilLabel.textContent = "Until";

    const untilInput = document.createElement("input");
    untilInput.type = "datetime-local";
    untilInput.dataset.role = "visibleUntil";
    untilInput.dataset.classId = classItem.id;
    untilLabel.appendChild(untilInput);

    const presetLabel = document.createElement("label");
    presetLabel.textContent = "Schedule Preset";

    const presetSelect = document.createElement("select");
    presetSelect.dataset.role = "schedulePreset";
    presetSelect.dataset.classId = classItem.id;

    Object.entries(SCHEDULE_PRESETS).forEach(([value, preset]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = preset.label;
      presetSelect.appendChild(option);
    });
    presetLabel.appendChild(presetSelect);

    row.append(checkbox, text, presetLabel, fromLabel, untilLabel);
    assignmentList.appendChild(row);
  });
}

function renderBlockFilterOptions(classes) {
  const previousValue = reportBlockFilter.value;
  const blockNumbers = [...new Set(classes.map((classItem) => classItem.blockNumber))].sort(
    (left, right) => left - right
  );

  reportBlockFilter.innerHTML = '<option value="">All blocks</option>';
  blockNumbers.forEach((blockNumber) => {
    const option = document.createElement("option");
    option.value = String(blockNumber);
    option.textContent = `Block ${blockNumber}`;
    reportBlockFilter.appendChild(option);
  });

  if (previousValue && blockNumbers.includes(Number(previousValue))) {
    reportBlockFilter.value = previousValue;
  }
}

async function loadAssignments() {
  const response = await fetch(`${API_BASE}/admin/classes`, { credentials: "include" });
  if (!response.ok) {
    setMessage("Unable to load classes for assignment.", true);
    renderAssignments([]);
    return;
  }

  const data = await response.json();
  cachedClasses = data.classes || [];
  renderAssignments(cachedClasses);
  renderBlockFilterOptions(cachedClasses);
}

function renderReportRows(reportRows) {
  reportBody.innerHTML = "";

  if (!reportRows.length) {
    reportTable.hidden = true;
    reportEmpty.hidden = false;
    return;
  }

  reportTable.hidden = false;
  reportEmpty.hidden = true;

  reportRows.forEach((row) => {
    const tableRow = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.textContent = row.title;

    const assignedCell = document.createElement("td");
    assignedCell.textContent = String(row.assignedCount);

    const submittedCell = document.createElement("td");
    submittedCell.textContent = String(row.submittedCount);

    const averageCell = document.createElement("td");
    averageCell.textContent = row.averageScore === null ? "-" : Number(row.averageScore).toFixed(2);

    tableRow.append(titleCell, assignedCell, submittedCell, averageCell);
    reportBody.appendChild(tableRow);
  });
}

async function loadReport() {
  const query = reportBlockFilter.value
    ? `?blockNumber=${encodeURIComponent(reportBlockFilter.value)}`
    : "";
  const response = await fetch(`${API_BASE}/admin/reports/quiz-summary${query}`, {
    credentials: "include",
  });
  if (!response.ok) {
    setMessage("Unable to load report.", true);
    renderReportRows([]);
    return;
  }

  const data = await response.json();
  renderReportRows(data.report || []);
}

function renderSummary(summary) {
  const today = summary?.today || {
    activeQuizCount: 0,
    assignedCount: 0,
    submittedCount: 0,
    publishable: [],
  };
  const thisWeek = summary?.thisWeek || {
    activeQuizCount: 0,
    assignedCount: 0,
    submittedCount: 0,
    publishable: [],
  };

  summaryTodayActive.textContent = `${today.activeQuizCount} active quizzes`;
  summaryTodayProgress.textContent = `${today.submittedCount} submitted / ${today.assignedCount} assigned`;
  summaryWeekActive.textContent = `${thisWeek.activeQuizCount} active quizzes`;
  summaryWeekProgress.textContent = `${thisWeek.submittedCount} submitted / ${thisWeek.assignedCount} assigned`;

  const publishableByQuizId = new Map();
  [...(today.publishable || []), ...(thisWeek.publishable || [])].forEach((item) => {
    if (!publishableByQuizId.has(item.quizId)) {
      publishableByQuizId.set(item.quizId, item);
    }
  });
  const publishable = Array.from(publishableByQuizId.values());

  summaryPublishActions.innerHTML = "";
  if (!publishable.length) {
    summaryPublishActions.hidden = true;
    summaryPublishEmpty.hidden = false;
    return;
  }

  summaryPublishActions.hidden = false;
  summaryPublishEmpty.hidden = true;
  publishable.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-btn";
    button.dataset.action = "publishResultsSummary";
    button.dataset.quizId = item.quizId;
    button.textContent = `Publish: ${item.title} (${item.submittedCount}/${item.assignedCount})`;
    summaryPublishActions.appendChild(button);
  });
}

async function loadSummary() {
  const timezoneOffsetMinutes = new Date().getTimezoneOffset();
  const response = await fetch(
    `${API_BASE}/admin/reports/operations-summary?timezoneOffsetMinutes=${encodeURIComponent(
      timezoneOffsetMinutes
    )}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    setMessage("Unable to load weekly summary.", true);
    renderSummary(null);
    return;
  }

  const data = await response.json();
  renderSummary(data.summary);
}

function renderQuizList(quizzes) {
  quizListBody.innerHTML = "";

  if (!quizzes.length) {
    quizListTable.hidden = true;
    quizListEmpty.hidden = false;
    return;
  }

  quizListTable.hidden = false;
  quizListEmpty.hidden = true;

  quizzes.forEach((quiz) => {
    const row = document.createElement("tr");

    const titleCell = document.createElement("td");
    titleCell.textContent = quiz.title;

    const statusCell = document.createElement("td");
    statusCell.textContent = quiz.status;

    const resultCell = document.createElement("td");
    resultCell.textContent = quiz.resultStatus || "hidden";

    const blocksCell = document.createElement("td");
    blocksCell.textContent = String(quiz.assignments?.length || 0);

    const actionsCell = document.createElement("td");

    const duplicateButton = document.createElement("button");
    duplicateButton.type = "button";
    duplicateButton.className = "action-btn";
    duplicateButton.dataset.action = "duplicate";
    duplicateButton.dataset.quizId = quiz.id;
    duplicateButton.textContent = "Duplicate";
    actionsCell.appendChild(duplicateButton);

    if (quiz.status === "draft") {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "action-btn edit";
      editButton.dataset.action = "edit";
      editButton.dataset.quizId = quiz.id;
      editButton.textContent = "Edit";
      actionsCell.appendChild(editButton);

      const publishButton = document.createElement("button");
      publishButton.type = "button";
      publishButton.className = "action-btn";
      publishButton.dataset.action = "publishQuiz";
      publishButton.dataset.quizId = quiz.id;
      publishButton.textContent = "Publish Quiz";
      actionsCell.appendChild(publishButton);
    } else {
      const publishedTag = document.createElement("span");
      publishedTag.className = "subtitle";
      publishedTag.textContent = "Quiz published";
      actionsCell.appendChild(publishedTag);
    }

    if (quiz.status === "published" && quiz.resultStatus !== "published") {
      const publishResultsButton = document.createElement("button");
      publishResultsButton.type = "button";
      publishResultsButton.className = "action-btn";
      publishResultsButton.dataset.action = "publishResults";
      publishResultsButton.dataset.quizId = quiz.id;
      publishResultsButton.textContent = "Publish Results";
      actionsCell.appendChild(publishResultsButton);
    } else if (quiz.resultStatus === "published") {
      const resultsTag = document.createElement("span");
      resultsTag.className = "subtitle";
      resultsTag.textContent = "Results released";
      actionsCell.appendChild(resultsTag);
    }

    row.append(titleCell, statusCell, resultCell, blocksCell, actionsCell);
    quizListBody.appendChild(row);
  });
}

async function loadDrafts() {
  const response = await fetch(`${API_BASE}/admin/quizzes`, { credentials: "include" });
  if (!response.ok) {
    setMessage("Unable to load quizzes.", true);
    return;
  }

  const data = await response.json();
  cachedQuizzes = data.quizzes || [];
  renderQuizList(cachedQuizzes);

  const drafts = cachedQuizzes.filter((quiz) => quiz.status === "draft");

  draftSelect.innerHTML = '<option value="">Select a draft to edit</option>';
  drafts.forEach((draft) => {
    const option = document.createElement("option");
    option.value = draft.id;
    option.textContent = draft.title;
    draftSelect.appendChild(option);
  });
}

function resetQuizForm() {
  editingQuizId = null;
  quizForm.reset();
  renderQuestionCards();
  draftSelect.value = "";
  syncActionState();
  setMessage("Ready to create a new draft.");
}

async function loadQuizIntoForm(quizId) {
  const response = await fetch(`${API_BASE}/admin/quizzes/${quizId}`, { credentials: "include" });
  if (!response.ok) {
    setMessage("Unable to load selected draft.", true);
    return;
  }

  const data = await response.json();
  const quiz = data.quiz;

  editingQuizId = quiz.id;
  syncActionState();
  quizTitleInput.value = quiz.title;
  quizDescriptionInput.value = quiz.description || "";

  const cards = Array.from(document.querySelectorAll(".question-card"));
  quiz.questions.forEach((question, index) => {
    const card = cards[index];
    if (!card) {
      return;
    }

    card.querySelector('[data-role="prompt"]').value = question.prompt;
    question.choices.forEach((choice) => {
      const choiceInput = card.querySelector(
        `[data-role="choice"][data-choice-label="${choice.label}"]`
      );
      choiceInput.value = choice.text;
    });

    const answerKey = question.choices.find((choice) => choice.isCorrect)?.label || "A";
    card.querySelector('[data-role="answerKey"]').value = answerKey;
  });

  document.querySelectorAll('[data-role="assignment"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
  document.querySelectorAll('[data-role="visibleFrom"]').forEach((input) => {
    input.value = "";
  });
  document.querySelectorAll('[data-role="visibleUntil"]').forEach((input) => {
    input.value = "";
  });
  document.querySelectorAll('[data-role="schedulePreset"]').forEach((input) => {
    input.value = "custom";
  });

  quiz.assignments.forEach((assignment) => {
    const checkbox = document.querySelector(
      `[data-role="assignment"][value="${assignment.classId}"]`
    );
    const fromInput = document.querySelector(
      `[data-role="visibleFrom"][data-class-id="${assignment.classId}"]`
    );
    const untilInput = document.querySelector(
      `[data-role="visibleUntil"][data-class-id="${assignment.classId}"]`
    );

    if (checkbox) {
      checkbox.checked = true;
    }
    if (fromInput) {
      fromInput.value = toLocalDatetimeValue(assignment.visibleFromUtc);
    }
    if (untilInput) {
      untilInput.value = toLocalDatetimeValue(assignment.visibleUntilUtc);
    }
  });

  setMessage(`Editing draft: ${quiz.title}`);
}

function buildQuizPayload() {
  const cards = Array.from(document.querySelectorAll(".question-card"));
  const assignmentInputs = Array.from(
    document.querySelectorAll('[data-role="assignment"]:checked')
  );

  return {
    title: quizTitleInput.value,
    description: quizDescriptionInput.value || undefined,
    assignments: assignmentInputs.map((input) => {
      const fromInput = document.querySelector(
        `[data-role="visibleFrom"][data-class-id="${input.value}"]`
      );
      const untilInput = document.querySelector(
        `[data-role="visibleUntil"][data-class-id="${input.value}"]`
      );

      return {
        classId: input.value,
        visibleFromUtc: new Date(fromInput.value).toISOString(),
        visibleUntilUtc: new Date(untilInput.value).toISOString(),
      };
    }),
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

function applySchedulePreset(classId, presetKey) {
  const preset = SCHEDULE_PRESETS[presetKey];
  if (!preset) {
    return;
  }

  const schedule = preset.resolve();
  if (!schedule) {
    return;
  }

  const fromInput = document.querySelector(`[data-role="visibleFrom"][data-class-id="${classId}"]`);
  const untilInput = document.querySelector(
    `[data-role="visibleUntil"][data-class-id="${classId}"]`
  );
  const assignmentInput = document.querySelector(`[data-role="assignment"][value="${classId}"]`);
  if (!fromInput || !untilInput) {
    return;
  }

  fromInput.value = toLocalDatetimeValueFromDate(schedule.from);
  untilInput.value = toLocalDatetimeValueFromDate(schedule.until);
  if (assignmentInput) {
    assignmentInput.checked = true;
  }
}

assignmentList.addEventListener("change", (event) => {
  const presetSelect = event.target.closest('select[data-role="schedulePreset"]');
  if (presetSelect) {
    applySchedulePreset(presetSelect.dataset.classId, presetSelect.value);
  }
});

quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(editingQuizId ? "Updating quiz draft..." : "Saving quiz draft...");

  if (!document.querySelector('[data-role="assignment"]:checked')) {
    setMessage("Select at least one block before saving.", true);
    return;
  }

  const selectedAssignments = Array.from(
    document.querySelectorAll('[data-role="assignment"]:checked')
  );
  const hasInvalidWindow = selectedAssignments.some((input) => {
    const fromInput = document.querySelector(
      `[data-role="visibleFrom"][data-class-id="${input.value}"]`
    );
    const untilInput = document.querySelector(
      `[data-role="visibleUntil"][data-class-id="${input.value}"]`
    );

    if (!fromInput.value || !untilInput.value) {
      return true;
    }

    return new Date(untilInput.value) <= new Date(fromInput.value);
  });
  if (hasInvalidWindow) {
    setMessage("Each selected block must have a valid start/end schedule.", true);
    return;
  }

  const endpoint = editingQuizId
    ? `${API_BASE}/admin/quizzes/${editingQuizId}`
    : `${API_BASE}/admin/quizzes`;
  const method = editingQuizId ? "PUT" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(buildQuizPayload()),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to save quiz draft.", true);
    return;
  }

  const data = await response.json();
  await loadDrafts();
  draftSelect.value = data.quiz.id;
  editingQuizId = data.quiz.id;
  syncActionState();
  setMessage(editingQuizId ? "Quiz draft saved." : "Quiz draft created.");
});

draftSelect.addEventListener("change", async () => {
  if (!draftSelect.value) {
    resetQuizForm();
    return;
  }

  await loadQuizIntoForm(draftSelect.value);
});

refreshQuizzesButton.addEventListener("click", async () => {
  await loadDrafts();
  await loadReport();
  await loadSummary();
  setMessage("Draft list refreshed.");
});

newQuizButton.addEventListener("click", () => {
  resetQuizForm();
});

publishQuizButton.addEventListener("click", async () => {
  if (!editingQuizId) {
    setMessage("Load a draft first, then publish.", true);
    return;
  }

  const response = await fetch(`${API_BASE}/admin/quizzes/${editingQuizId}/publish`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to publish quiz.", true);
    return;
  }

  await loadDrafts();
  await loadSummary();
  resetQuizForm();
  setMessage("Quiz published.");
});

quizListBody.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    return;
  }

  const quizId = actionButton.dataset.quizId;
  const action = actionButton.dataset.action;
  if (!quizId || !action) {
    return;
  }

  if (action === "edit") {
    draftSelect.value = quizId;
    await loadQuizIntoForm(quizId);
    return;
  }

  if (action === "duplicate") {
    const response = await fetch(`${API_BASE}/admin/quizzes/${quizId}/duplicate`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      setMessage(errorPayload.error || "Unable to duplicate quiz.", true);
      return;
    }

    const data = await response.json();
    await loadDrafts();
    await loadSummary();
    draftSelect.value = data.quiz.id;
    await loadQuizIntoForm(data.quiz.id);
    setMessage("Quiz duplicated into a new draft.");
    return;
  }

  if (action === "publishQuiz") {
    const response = await fetch(`${API_BASE}/admin/quizzes/${quizId}/publish`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      setMessage(errorPayload.error || "Unable to publish quiz.", true);
      return;
    }

    await loadDrafts();
    await loadReport();
    await loadSummary();
    if (editingQuizId === quizId) {
      resetQuizForm();
    }
    setMessage("Quiz published.");
    return;
  }

  if (action === "publishResults") {
    const response = await fetch(`${API_BASE}/admin/quizzes/${quizId}/publish-results`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      setMessage(errorPayload.error || "Unable to publish results.", true);
      return;
    }

    await loadDrafts();
    await loadReport();
    await loadSummary();
    setMessage("Results published.");
  }
});

refreshReportButton.addEventListener("click", async () => {
  await loadReport();
  setMessage("Report refreshed.");
});

refreshSummaryButton.addEventListener("click", async () => {
  await loadSummary();
  setMessage("Summary refreshed.");
});

reportBlockFilter.addEventListener("change", async () => {
  await loadReport();
});

summaryPublishActions.addEventListener("click", async (event) => {
  const publishButton = event.target.closest('button[data-action="publishResultsSummary"]');
  if (!publishButton) {
    return;
  }

  const response = await fetch(
    `${API_BASE}/admin/quizzes/${publishButton.dataset.quizId}/publish-results`,
    {
      method: "POST",
      credentials: "include",
    }
  );
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to publish results.", true);
    return;
  }

  await loadDrafts();
  await loadReport();
  await loadSummary();
  setMessage("Results published.");
});

logoutButton?.addEventListener("click", async () => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "index.html";
});

renderQuestionCards();
syncActionState();
loadAssignments().then(loadDrafts).then(loadReport).then(loadSummary);
