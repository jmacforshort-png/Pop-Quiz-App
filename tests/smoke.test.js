describe("project bootstrap", () => {
  it("loads the quiz script with required constants", async () => {
    const fs = require("node:fs/promises");
    const appSource = await fs.readFile("app.js", "utf8");

    expect(appSource).toContain("const QUESTIONS");
  });
});
