const fs = require("node:fs/promises");

describe("student quiz script", () => {
  it("includes submission call to expected endpoint", async () => {
    const script = await fs.readFile("student-quiz.js", "utf8");

    expect(script).toContain("/student/quizzes/${quizId}/submit");
    expect(script).toContain("collectAnswers");
  });
});
