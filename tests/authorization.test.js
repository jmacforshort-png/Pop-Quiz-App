const { requireAuth, requireRole } = require("../src/server/authMiddleware");
const { issueSessionToken, SESSION_COOKIE } = require("../src/server/session");

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("auth middleware", () => {
  it("rejects missing session token", () => {
    const middleware = requireAuth("test-secret");
    const req = { cookies: {} };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches auth payload for valid token", () => {
    const token = issueSessionToken(
      { id: "user_1", username: "admin_user", role: "admin" },
      "test-secret"
    );
    const middleware = requireAuth("test-secret");
    const req = { cookies: { [SESSION_COOKIE]: token } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.auth.sub).toBe("user_1");
    expect(req.auth.role).toBe("admin");
  });
});

describe("role middleware", () => {
  it("rejects unauthorized role", () => {
    const middleware = requireRole("admin");
    const req = { auth: { role: "student" } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows permitted role", () => {
    const middleware = requireRole(["admin", "student"]);
    const req = { auth: { role: "student" } };
    const res = createMockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
