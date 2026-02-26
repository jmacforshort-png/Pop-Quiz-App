describe("project bootstrap", () => {
  it("loads auth portal and bootstrap script references", async () => {
    const fs = require("node:fs/promises");
    const appSource = await fs.readFile("app.js", "utf8");
    const htmlSource = await fs.readFile("index.html", "utf8");
    const packageJsonSource = await fs.readFile("package.json", "utf8");

    expect(appSource).toContain("const loginForm");
    expect(appSource).toContain("const signupForm");
    expect(htmlSource).toContain('id="login-form"');
    expect(htmlSource).toContain('id="signup-form"');
    expect(packageJsonSource).toContain('"admin:bootstrap"');
  });
});
