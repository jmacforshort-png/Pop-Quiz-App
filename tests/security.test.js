const { hashPassword, resolveSaltRounds, verifyPassword } = require("../src/server/password");
const { issueSessionToken, verifySessionToken } = require("../src/server/session");

describe("password security", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("secret123");

    expect(hash).not.toBe("secret123");
    expect(await verifyPassword("secret123", hash)).toBe(true);
    expect(await verifyPassword("wrongpass", hash)).toBe(false);
  });

  it("uses safe default rounds when env value is weak", () => {
    const previousRounds = process.env.AUTH_SALT_ROUNDS;
    process.env.AUTH_SALT_ROUNDS = "4";
    expect(resolveSaltRounds()).toBe(12);
    process.env.AUTH_SALT_ROUNDS = previousRounds;
  });
});

describe("session security", () => {
  it("issues and verifies JWT session tokens", () => {
    const token = issueSessionToken(
      {
        id: "user_1",
        username: "student_one",
        role: "student",
      },
      "test-secret"
    );

    const payload = verifySessionToken(token, "test-secret");

    expect(payload.sub).toBe("user_1");
    expect(payload.username).toBe("student_one");
    expect(payload.role).toBe("student");
  });
});
