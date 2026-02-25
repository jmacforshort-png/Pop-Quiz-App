const cookieParser = require("cookie-parser");
const express = require("express");
const { createAuthService, AuthServiceError } = require("./authService");
const { attachSessionCookie, clearSessionCookie } = require("./session");

function createAuthApp({ prisma, jwtSecret }) {
  const authService = createAuthService({ prisma, jwtSecret });
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.post("/auth/signup", async (req, res) => {
    try {
      const result = await authService.signup(req.body);
      attachSessionCookie(res, result.token);

      return res.status(201).json({ user: result.user });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to create account." });
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const result = await authService.login(req.body);
      attachSessionCookie(res, result.token);

      return res.status(200).json({ user: result.user });
    } catch (error) {
      if (error instanceof AuthServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to log in." });
    }
  });

  app.post("/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  });

  return app;
}

module.exports = {
  createAuthApp,
};
