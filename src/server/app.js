const cookieParser = require("cookie-parser");
const express = require("express");
const { AUDIT_ACTIONS, createAuditService } = require("./auditService");
const { createAuthService, AuthServiceError } = require("./authService");
const { requireAuth, requireRole } = require("./authMiddleware");
const { createClassService, ClassServiceError } = require("./classService");
const { createStudentQuizService, StudentQuizServiceError } = require("./studentQuizService");
const { createStudentService, StudentServiceError } = require("./studentService");
const { createQuizService, QuizServiceError } = require("./quizService");
const { attachSessionCookie, clearSessionCookie } = require("./session");

function createAuthApp({ prisma, jwtSecret }) {
  const authService = createAuthService({ prisma, jwtSecret });
  const auditService = createAuditService({ prisma });
  const classService = createClassService({ prisma });
  const studentQuizService = createStudentQuizService({ prisma });
  const studentService = createStudentService({ prisma });
  const quizService = createQuizService({ prisma });
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/auth/blocks", async (_req, res) => {
    const classes = await prisma.class.findMany({
      select: { id: true, name: true, blockNumber: true },
      orderBy: [{ blockNumber: "asc" }, { name: "asc" }],
    });

    return res.status(200).json({ classes });
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
        classId: req.auth.classId ?? null,
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

  app.get("/student/quizzes", requireAuth(jwtSecret), requireRole("student"), async (req, res) => {
    try {
      const quizzes = await studentQuizService.listAvailableQuizzes({
        classId: req.auth.classId,
      });
      return res.status(200).json({ quizzes });
    } catch (error) {
      if (error instanceof StudentQuizServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to load available quizzes." });
    }
  });

  app.get(
    "/student/quizzes/:quizId",
    requireAuth(jwtSecret),
    requireRole("student"),
    async (req, res) => {
      try {
        const quiz = await studentQuizService.getQuizForStudent({
          classId: req.auth.classId,
          quizId: req.params.quizId,
        });
        return res.status(200).json({ quiz });
      } catch (error) {
        if (error instanceof StudentQuizServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to load quiz." });
      }
    }
  );

  app.get("/student/results", requireAuth(jwtSecret), requireRole("student"), async (req, res) => {
    try {
      const results = await studentQuizService.listStudentResults({
        studentId: req.auth.sub,
      });
      return res.status(200).json({ results });
    } catch (error) {
      if (error instanceof StudentQuizServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to load student results." });
    }
  });

  app.post(
    "/student/quizzes/:quizId/submit",
    requireAuth(jwtSecret),
    requireRole("student"),
    async (req, res) => {
      try {
        const attempt = await studentQuizService.submitQuizAttempt({
          classId: req.auth.classId,
          quizId: req.params.quizId,
          studentId: req.auth.sub,
          answers: req.body.answers,
        });
        return res.status(201).json({ attempt });
      } catch (error) {
        if (error instanceof StudentQuizServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to submit quiz attempt." });
      }
    }
  );

  app.get("/admin/classes", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    const classes = await classService.listClasses(req.auth.sub);
    return res.status(200).json({ classes });
  });

  app.post("/admin/classes", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    try {
      const createdClass = await classService.createClass(req.auth.sub, req.body);
      await auditService.logAction({
        actorUserId: req.auth.sub,
        action: AUDIT_ACTIONS.CLASS_CREATED,
        targetType: "class",
        targetId: createdClass.id,
      });
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
        await auditService.logAction({
          actorUserId: req.auth.sub,
          action: AUDIT_ACTIONS.CLASS_UPDATED,
          targetType: "class",
          targetId: updatedClass.id,
        });
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
        await auditService.logAction({
          actorUserId: req.auth.sub,
          action: AUDIT_ACTIONS.CLASS_DELETED,
          targetType: "class",
          targetId: req.params.classId,
        });
        return res.status(204).send();
      } catch (error) {
        if (error instanceof ClassServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to delete class." });
      }
    }
  );

  app.get("/admin/students", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    try {
      const students = await studentService.listStudents(req.auth.sub, req.query);
      return res.status(200).json({ students });
    } catch (error) {
      if (error instanceof StudentServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to load students." });
    }
  });

  app.post(
    "/admin/students/:studentId/reset-password",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        const result = await studentService.resetStudentPassword(
          req.auth.sub,
          req.params.studentId,
          req.body
        );
        await auditService.logAction({
          actorUserId: req.auth.sub,
          action: AUDIT_ACTIONS.STUDENT_PASSWORD_RESET,
          targetType: "user",
          targetId: req.params.studentId,
        });
        return res.status(200).json({
          temporaryPassword: result.temporaryPassword,
          generated: result.wasGenerated,
        });
      } catch (error) {
        if (error instanceof StudentServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to reset password." });
      }
    }
  );

  app.get("/admin/audit-logs", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isInteger(requestedLimit) ? requestedLimit : 50;
    const logs = await auditService.listLogsForAdmin(req.auth.sub, limit);
    return res.status(200).json({ logs });
  });

  app.post("/admin/quizzes", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    try {
      const quiz = await quizService.createDraftQuiz(req.auth.sub, req.body);
      await auditService.logAction({
        actorUserId: req.auth.sub,
        action: AUDIT_ACTIONS.QUIZ_DRAFT_CREATED,
        targetType: "quiz",
        targetId: quiz.id,
        quizId: quiz.id,
      });
      return res.status(201).json({ quiz });
    } catch (error) {
      if (error instanceof QuizServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      return res.status(500).json({ error: "Unable to create quiz." });
    }
  });

  app.get("/admin/quizzes", requireAuth(jwtSecret), requireRole("admin"), async (req, res) => {
    const quizzes = await quizService.listQuizzes(req.auth.sub);
    return res.status(200).json({ quizzes });
  });

  app.get(
    "/admin/reports/quiz-summary",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      const rawBlockNumber = req.query.blockNumber;
      const blockNumber =
        rawBlockNumber === undefined || rawBlockNumber === ""
          ? undefined
          : Number.parseInt(rawBlockNumber, 10);

      if (rawBlockNumber !== undefined && rawBlockNumber !== "" && !Number.isInteger(blockNumber)) {
        return res.status(400).json({ error: "blockNumber must be a valid integer." });
      }

      const report = await quizService.getQuizSummaryReport(req.auth.sub, {
        blockNumber,
      });
      return res.status(200).json({ report });
    }
  );

  app.get(
    "/admin/quizzes/:quizId",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        const quiz = await quizService.getQuizById(req.auth.sub, req.params.quizId);
        return res.status(200).json({ quiz });
      } catch (error) {
        if (error instanceof QuizServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to load quiz." });
      }
    }
  );

  app.put(
    "/admin/quizzes/:quizId",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        const quiz = await quizService.updateDraftQuiz(req.auth.sub, req.params.quizId, req.body);
        await auditService.logAction({
          actorUserId: req.auth.sub,
          action: AUDIT_ACTIONS.QUIZ_DRAFT_UPDATED,
          targetType: "quiz",
          targetId: quiz.id,
          quizId: quiz.id,
        });
        return res.status(200).json({ quiz });
      } catch (error) {
        if (error instanceof QuizServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to update quiz." });
      }
    }
  );

  app.post(
    "/admin/quizzes/:quizId/publish",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        const quiz = await quizService.publishQuiz(req.auth.sub, req.params.quizId);
        await auditService.logAction({
          actorUserId: req.auth.sub,
          action: AUDIT_ACTIONS.QUIZ_PUBLISHED,
          targetType: "quiz",
          targetId: quiz.id,
          quizId: quiz.id,
        });
        return res.status(200).json({ quiz });
      } catch (error) {
        if (error instanceof QuizServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to publish quiz." });
      }
    }
  );

  app.post(
    "/admin/quizzes/:quizId/publish-results",
    requireAuth(jwtSecret),
    requireRole("admin"),
    async (req, res) => {
      try {
        const quiz = await quizService.publishResults(req.auth.sub, req.params.quizId);
        await auditService.logAction({
          actorUserId: req.auth.sub,
          action: AUDIT_ACTIONS.QUIZ_RESULTS_PUBLISHED,
          targetType: "quiz",
          targetId: quiz.id,
          quizId: quiz.id,
        });
        return res.status(200).json({ quiz });
      } catch (error) {
        if (error instanceof QuizServiceError) {
          return res.status(error.statusCode).json({ error: error.message });
        }

        return res.status(500).json({ error: "Unable to publish results." });
      }
    }
  );

  return app;
}

module.exports = {
  createAuthApp,
};
