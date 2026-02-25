const cookieParser = require("cookie-parser");
const express = require("express");
const { createAuthService, AuthServiceError } = require("./authService");
const { requireAuth, requireRole } = require("./authMiddleware");
const { createClassService, ClassServiceError } = require("./classService");
const { attachSessionCookie, clearSessionCookie } = require("./session");

function createAuthApp({ prisma, jwtSecret }) {
  const authService = createAuthService({ prisma, jwtSecret });
  const classService = createClassService({ prisma });
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

  app.get("/auth/me", requireAuth(jwtSecret), (req, res) => {
    return res.status(200).json({
      user: {
        id: req.auth.sub,
        username: req.auth.username,
        role: req.auth.role,
      },
    });
  });

  app.get("/admin/ping", requireAuth(jwtSecret), requireRole("admin"), (_req, res) => {
    return res.status(200).json({ ok: true });
  });

  app.get(
    "/student/ping",
    requireAuth(jwtSecret),
    requireRole(["student", "admin"]),
    (_req, res) => {
      return res.status(200).json({ ok: true });
    }
  );

  app.get("/admin/classes", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    const classes = await classService.listClasses(req.auth.sub);
    return res.status(200).json({ classes });
  });

  app.post("/admin/classes", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    try {
      const createdClass = await classService.createClass(req.auth.sub, req.body);
      return res.status(201).json({ class: createdClass });
    } catch (error) {
      if (error instanceof ClassServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to create class." });
    }
  });

  app.put(
    "/admin/classes/:classId",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        const updatedClass = await classService.updateClass(
          req.auth.sub,
          req.params.classId,
          req.body
        );
        return res.status(200).json({ class: updatedClass });
      } catch (error) {
        if (error instanceof ClassServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to update class." });
      }
    }
  );

  app.delete(
    "/admin/classes/:classId",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        await classService.deleteClass(req.auth.sub, req.params.classId);
        return res.status(204).send();
      } catch (error) {
        if (error instanceof ClassServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to delete class." });
      }
    }
  );

  return app;
}

module.exports = {
  createAuthApp,
};
