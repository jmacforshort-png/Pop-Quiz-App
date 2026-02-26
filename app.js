const API_BASE = window.localStorage.getItem("popQuizApiBase") || "http://localhost:3000";

const loginForm = document.getElementById("login-form");
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const signupForm = document.getElementById("signup-form");
const signupUsernameInput = document.getElementById("signup-username");
const signupPasswordInput = document.getElementById("signup-password");
const signupBlockSelect = document.getElementById("signup-block");
const messageText = document.getElementById("auth-message");

function setMessage(text, isError = false) {
  messageText.textContent = text;
  messageText.style.color = isError ? "var(--bad)" : "var(--muted)";
}

function redirectForRole(role) {
  if (role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  if (role === "student") {
    window.location.href = "student.html";
  }
}

async function loadBlocks() {
  signupBlockSelect.innerHTML = '<option value="">Loading blocks...</option>';
  const response = await fetch(`${API_BASE}/auth/blocks`, { credentials: "include" });
  if (!response.ok) {
    signupBlockSelect.innerHTML = '<option value="">No blocks available</option>';
    setMessage("Unable to load blocks. Ask your teacher to create classes first.", true);
    return;
  }

  const data = await response.json();
  const classes = data.classes || [];

  if (!classes.length) {
    signupBlockSelect.innerHTML = '<option value="">No blocks available</option>';
    setMessage("No blocks are available yet. Ask your teacher to create classes first.", true);
    return;
  }

  signupBlockSelect.innerHTML = '<option value="">Select a block</option>';
  classes.forEach((classItem) => {
    const option = document.createElement("option");
    option.value = String(classItem.blockNumber);
    option.textContent = `${classItem.name} (Block ${classItem.blockNumber})`;
    signupBlockSelect.appendChild(option);
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Logging in...");

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: loginUsernameInput.value,
      password: loginPasswordInput.value,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    setMessage(payload.error || "Unable to log in.", true);
    return;
  }

  setMessage("Logged in. Redirecting...");
  redirectForRole(payload.user?.role);
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Creating account...");

  const response = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      username: signupUsernameInput.value,
      password: signupPasswordInput.value,
      blockNumber: Number(signupBlockSelect.value),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    setMessage(payload.error || "Unable to create account.", true);
    return;
  }

  setMessage("Account created. Redirecting...");
  redirectForRole(payload.user?.role);
});

async function bootstrapAuthPage() {
  try {
    const meResponse = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    if (meResponse.ok) {
      const data = await meResponse.json();
      redirectForRole(data.user?.role);
      return;
    }
  } catch {
    // If API is unavailable, fall through and show auth forms.
  }

  await loadBlocks();
}

bootstrapAuthPage();
