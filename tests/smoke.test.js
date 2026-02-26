describe("project bootstrap", () => {
  it("loads auth portal script with login/signup handlers", async () => {
    const fs = require("node:fs/promises");
    const appSource = await fs.readFile("app.js", "utf8");
    const htmlSource = await fs.readFile("index.html", "utf8");

    expect(appSource).toContain("const loginForm");
    expect(appSource).toContain("const signupForm");
    expect(htmlSource).toContain('id="login-form"');
    expect(htmlSource).toContain('id="signup-form"');
  });
});
