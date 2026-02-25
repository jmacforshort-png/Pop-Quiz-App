const REQUIRED_QUESTION_COUNT = 5;
const REQUIRED_LABELS = ["A", "B", "C", "D"];

function hasRequiredChoices(choices) {
  if (!Array.isArray(choices) || choices.length !== REQUIRED_LABELS.length) {
    return false;
  }

  const sortedLabels = choices.map((choice) => choice.label).sort();
  return REQUIRED_LABELS.every((label, index) => sortedLabels[index] === label);
}

function countCorrectChoices(choices) {
  return choices.reduce((total, choice) => (choice.isCorrect ? total + 1 : total), 0);
}

function validateFixedQuizPayload(quizPayload) {
  const errors = [];

  if (!quizPayload || !Array.isArray(quizPayload.questions)) {
    errors.push("Quiz payload must include a questions array.");
    return { valid: false, errors };
  }

  if (quizPayload.questions.length !== REQUIRED_QUESTION_COUNT) {
    errors.push(`Quiz must include exactly ${REQUIRED_QUESTION_COUNT} questions.`);
  }

  quizPayload.questions.forEach((question, questionIndex) => {
    if (!question || typeof question.prompt !== "string" || question.prompt.trim() === "") {
      errors.push(`Question ${questionIndex + 1} prompt is required.`);
    }

    if (!hasRequiredChoices(question?.choices)) {
      errors.push(`Question ${questionIndex + 1} must include choices A, B, C, and D.`);
      return;
    }

    const invalidChoiceText = question.choices.find(
      (choice) => typeof choice.text !== "string" || choice.text.trim() === ""
    );

    if (invalidChoiceText) {
      errors.push(`Question ${questionIndex + 1} has an empty choice value.`);
    }

    if (countCorrectChoices(question.choices) !== 1) {
      errors.push(`Question ${questionIndex + 1} must have exactly one correct choice.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  REQUIRED_QUESTION_COUNT,
  REQUIRED_LABELS,
  validateFixedQuizPayload,
};
