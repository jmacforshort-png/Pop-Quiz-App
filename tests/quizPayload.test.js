const { validateFixedQuizPayload } = require("../src/validation/quizPayload");

function buildValidPayload() {
  return {
    title: "Sample Quiz",
    questions: Array.from({ length: 5 }, (_, index) => ({
      prompt: `Question ${index + 1}`,
      choices: [
        { label: "A", text: "Option A", isCorrect: true },
        { label: "B", text: "Option B", isCorrect: false },
        { label: "C", text: "Option C", isCorrect: false },
        { label: "D", text: "Option D", isCorrect: false },
      ],
    })),
  };
}

describe("validateFixedQuizPayload", () => {
  it("accepts valid 5-question payload", () => {
    const result = validateFixedQuizPayload(buildValidPayload());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects payload with wrong question count", () => {
    const payload = buildValidPayload();
    payload.questions.pop();

    const result = validateFixedQuizPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Quiz must include exactly 5 questions.");
  });

  it("rejects question without A-D labels", () => {
    const payload = buildValidPayload();
    payload.questions[0].choices = [
      { label: "A", text: "Option A", isCorrect: true },
      { label: "B", text: "Option B", isCorrect: false },
      { label: "C", text: "Option C", isCorrect: false },
      { label: "E", text: "Option E", isCorrect: false },
    ];

    const result = validateFixedQuizPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Question 1 must include choices A, B, C, and D.");
  });

  it("rejects question with zero or multiple correct options", () => {
    const payload = buildValidPayload();
    payload.questions[1].choices.forEach((choice) => {
      choice.isCorrect = false;
    });
    payload.questions[2].choices[0].isCorrect = true;
    payload.questions[2].choices[1].isCorrect = true;

    const result = validateFixedQuizPayload(payload);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Question 2 must have exactly one correct choice.");
    expect(result.errors).toContain("Question 3 must have exactly one correct choice.");
  });
});
