const fs = require("node:fs/promises");

describe("student dashboard ui", () => {
  it("contains student quiz list container and script", async () => {
    const html = await fs.readFile("student.html", "utf8");

    expect(html).toContain('id="student-list"');
    expect(html).toContain('src="student-dashboard.js"');
  });
});
