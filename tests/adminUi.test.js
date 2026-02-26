const fs = require("node:fs/promises");

describe("admin classes ui", () => {
  it("includes class form and table containers", async () => {
    const html = await fs.readFile("admin.html", "utf8");

    expect(html).toContain('id="class-form"');
    expect(html).toContain('id="classes-table"');
    expect(html).toContain('id="admin-logout"');
    expect(html).toContain("admin-gradebook.html");
    expect(html).toContain('src="admin-classes.js"');
  });
});
