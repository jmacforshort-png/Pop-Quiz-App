const fs = require("node:fs/promises");

describe("admin gradebook ui", () => {
  it("contains gradebook filters, table, and script", async () => {
    const html = await fs.readFile("admin-gradebook.html", "utf8");

    expect(html).toContain('id="gradebook-class-filter"');
    expect(html).toContain('id="gradebook-quiz-filter"');
    expect(html).toContain('id="gradebook-week-start"');
    expect(html).toContain('id="gradebook-export"');
    expect(html).toContain('id="gradebook-table"');
    expect(html).toContain('id="admin-logout"');
    expect(html).toContain('src="admin-gradebook.js"');
  });
});
