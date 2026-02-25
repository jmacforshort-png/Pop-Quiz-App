const fs = require("node:fs/promises");

describe("admin quiz builder ui", () => {
  it("contains fixed quiz form shell", async () => {
    const html = await fs.readFile("admin-quizzes.html", "utf8");

    expect(html).toContain('id="quiz-form"');
    expect(html).toContain('id="draft-select"');
    expect(html).toContain('id="assignment-list"');
    expect(html).toContain('id="publish-quiz"');
    expect(html).toContain('id="question-cards"');
    expect(html).toContain('src="admin-quizzes.js"');
  });
});
