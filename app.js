const QUESTIONS = [
  {
    prompt: "Which planet is known as the Red Planet?",
    choices: ["Mars", "Jupiter", "Venus", "Mercury"],
    answer: "Mars",
  },
  {
    prompt: "What does CSS stand for?",
    choices: [
      "Cascading Style Sheets",
      "Computer Style Syntax",
      "Colorful Style Structure",
      "Core Styling System",
    ],
    answer: "Cascading Style Sheets",
  },
  {
    prompt: "Which company created the React library?",
    choices: ["Google", "Meta", "Microsoft", "Apple"],
    answer: "Meta",
  },
  {
    prompt: "What year did JavaScript first appear?",
    choices: ["1995", "2001", "1988", "2010"],
    answer: "1995",
  },
  {
    prompt: "Which data type is immutable in JavaScript?",
    choices: ["Array", "Object", "String", "Map"],
    answer: "String",
  },
];

const state = {
  index: 0,
  score: 0,
  timeLeft: 15,
  timerId: null,
  isLocked: false,
};

const startScreen = document.getElementById("start-screen");
const questionScreen = document.getElementById("question-screen");
const resultScreen = document.getElementById("result-screen");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const questionText = document.getElementById("question-text");
const answerList = document.getElementById("answer-list");
const questionCount = document.getElementById("question-count");
const timerText = document.getElementById("timer");
const scoreText = document.getElementById("score-text");

function showPanel(panel) {
  [startScreen, questionScreen, resultScreen].forEach((item) => item.classList.remove("active"));
  panel.classList.add("active");
}

function resetState() {
  state.index = 0;
  state.score = 0;
  state.timeLeft = 15;
  state.isLocked = false;
  clearInterval(state.timerId);
  state.timerId = null;
}

function startTimer() {
  clearInterval(state.timerId);
  timerText.textContent = `${state.timeLeft}s`;

  state.timerId = setInterval(() => {
    state.timeLeft -= 1;
    timerText.textContent = `${state.timeLeft}s`;

    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      lockQuestion(null);
      setTimeout(nextQuestion, 650);
    }
  }, 1000);
}

function renderQuestion() {
  const current = QUESTIONS[state.index];
  state.timeLeft = 15;
  state.isLocked = false;

  questionCount.textContent = `Question ${state.index + 1} / ${QUESTIONS.length}`;
  questionText.textContent = current.prompt;
  answerList.innerHTML = "";

  current.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";
    button.textContent = choice;
    button.addEventListener("click", () => lockQuestion(button));
    answerList.appendChild(button);
  });

  startTimer();
}

function lockQuestion(selectedBtn) {
  if (state.isLocked) {
    return;
  }

  state.isLocked = true;
  clearInterval(state.timerId);

  const current = QUESTIONS[state.index];
  const buttons = Array.from(answerList.querySelectorAll("button"));

  buttons.forEach((btn) => {
    const isCorrect = btn.textContent === current.answer;
    if (isCorrect) {
      btn.classList.add("correct");
    }

    if (selectedBtn && btn === selectedBtn && !isCorrect) {
      btn.classList.add("incorrect");
    }

    btn.disabled = true;
  });

  if (selectedBtn && selectedBtn.textContent === current.answer) {
    state.score += 1;
  } else if (selectedBtn) {
    state.timeLeft = Math.max(0, state.timeLeft - 4);
    timerText.textContent = `${state.timeLeft}s`;
  }

  setTimeout(nextQuestion, 650);
}

function nextQuestion() {
  state.index += 1;

  if (state.index >= QUESTIONS.length) {
    return finishQuiz();
  }

  renderQuestion();
}

function finishQuiz() {
  clearInterval(state.timerId);
  scoreText.textContent = `You scored ${state.score} out of ${QUESTIONS.length}.`;
  showPanel(resultScreen);
}

function startQuiz() {
  resetState();
  showPanel(questionScreen);
  renderQuestion();
}

startBtn.addEventListener("click", startQuiz);
restartBtn.addEventListener("click", startQuiz);
