const fs = require("node:fs/promises");

describe("student quiz page shell", () => {
  it("contains quiz page scaffold", async () => {
    const html = await fs.readFile("student-quiz.html", "utf8");

    expect(html).toContain("Take Quiz");
    expect(html).toContain("Back to available quizzes");
  });
});
