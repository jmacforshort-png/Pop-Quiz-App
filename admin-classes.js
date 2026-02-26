const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const classForm = document.getElementById("class-form");
const classFormTitle = document.getElementById("class-form-title");
const cancelEditBtn = document.getElementById("cancel-edit");
const messageText = document.getElementById("form-message");
const classNameInput = document.getElementById("class-name");
const classBlockInput = document.getElementById("class-block");
const table = document.getElementById("classes-table");
const tableBody = document.getElementById("classes-table-body");
const emptyState = document.getElementById("classes-empty");
const refreshButton = document.getElementById("refresh-classes");
const logoutButton = document.getElementById("admin-logout");

let editingClassId = null;

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function resetForm() {
  editingClassId = null;
  classForm.reset();
  classFormTitle.textContent = "Create Class";
  cancelEditBtn.hidden = true;
}

function renderClasses(classes) {
  tableBody.innerHTML = "";

  if (!classes.length) {
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  table.hidden = false;
  emptyState.hidden = true;

  classes.forEach((classItem) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    nameCell.textContent = classItem.name;

    const blockCell = document.createElement("td");
    blockCell.textContent = String(classItem.blockNumber);

    const actionsCell = document.createElement("td");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "action-btn edit";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      editingClassId = classItem.id;
      classFormTitle.textContent = "Edit Class";
      classNameInput.value = classItem.name;
      classBlockInput.value = String(classItem.blockNumber);
      cancelEditBtn.hidden = false;
      setMessage("Editing class.");
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "action-btn delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      const shouldDelete = window.confirm(
        `Delete ${classItem.name} (Block ${classItem.blockNumber})?`
      );
      if (!shouldDelete) {
        return;
      }

      const response = await fetch(`${API_BASE}/admin/classes/${classItem.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        setMessage("Unable to delete class.", true);
        return;
      }

      setMessage("Class deleted.");
      if (editingClassId === classItem.id) {
        resetForm();
      }
      await loadClasses();
    });

    actionsCell.append(editButton, deleteButton);

    row.append(nameCell, blockCell, actionsCell);
    tableBody.appendChild(row);
  });
}

async function loadClasses() {
  setMessage("Loading classes...");

  const response = await fetch(`${API_BASE}/admin/classes`, {
    credentials: "include",
  });

  if (!response.ok) {
    setMessage("Could not load classes. Make sure you are logged in as admin.", true);
    table.hidden = true;
    emptyState.hidden = false;
    return;
  }

  const data = await response.json();
  renderClasses(data.classes || []);
  setMessage("");
}

classForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: classNameInput.value,
    blockNumber: Number(classBlockInput.value),
  };

  const endpoint = editingClassId
    ? `${API_BASE}/admin/classes/${editingClassId}`
    : `${API_BASE}/admin/classes`;

  const method = editingClassId ? "PUT" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    setMessage(errorPayload.error || "Unable to save class.", true);
    return;
  }

  setMessage(editingClassId ? "Class updated." : "Class created.");
  resetForm();
  await loadClasses();
});

cancelEditBtn.addEventListener("click", () => {
  resetForm();
  setMessage("Edit canceled.");
});

refreshButton.addEventListener("click", async () => {
  await loadClasses();
});

logoutButton?.addEventListener("click", async () => {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "index.html";
});

loadClasses();
