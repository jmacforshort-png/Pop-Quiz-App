const { baseQuizSchema } = require("./quizSchemas");
const { validateFixedQuizPayload } = require("../validation/quizPayload");
const { parseUtcTimestamp } = require("./time");

class QuizServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toQuestionCreateInput(questions) {
  return questions.map((question, index) => ({
    orderIndex: index + 1,
    prompt: question.prompt,
    choices: {
      create: question.choices.map((choice) => ({
        label: choice.label,
        text: choice.text,
        isCorrect: choice.isCorrect,
      })),
    },
  }));
}

function toTemplateQuestionCreateInput(questions) {
  return questions.map((question, index) => ({
    orderIndex: index + 1,
    prompt: question.prompt,
    choices: {
      create: question.choices.map((choice) => ({
        label: choice.label,
        text: choice.text,
        isCorrect: choice.isCorrect,
      })),
    },
  }));
}

async function validateAndBuildQuizData(prisma, adminId, payload) {
  const parsed = baseQuizSchema.safeParse(payload);
  if (!parsed.success) {
    throw new QuizServiceError(400, parsed.error.issues[0]?.message ?? "Invalid quiz payload.");
  }

  const fixedValidation = validateFixedQuizPayload(parsed.data);
  if (!fixedValidation.valid) {
    throw new QuizServiceError(400, fixedValidation.errors[0] ?? "Invalid quiz structure.");
  }

  const classIds = [...new Set(parsed.data.assignments.map((assignment) => assignment.classId))];
  if (classIds.length !== parsed.data.assignments.length) {
    throw new QuizServiceError(400, "Each block can only be assigned once per quiz.");
  }

  const adminClasses = await prisma.class.findMany({
    where: { adminId, id: { in: classIds } },
    select: { id: true },
  });
  if (adminClasses.length !== classIds.length) {
    throw new QuizServiceError(403, "One or more assigned blocks are invalid.");
  }

  const scheduleEntries = parsed.data.assignments.map((assignment) => {
    let visibleFromUtc;
    let visibleUntilUtc;
    try {
      visibleFromUtc = parseUtcTimestamp(assignment.visibleFromUtc, "visibleFromUtc");
      visibleUntilUtc = parseUtcTimestamp(assignment.visibleUntilUtc, "visibleUntilUtc");
    } catch (error) {
      throw new QuizServiceError(400, error.message);
    }

    if (visibleUntilUtc <= visibleFromUtc) {
      throw new QuizServiceError(
        400,
        "Each block assignment needs a valid visibility window (end must be after start)."
      );
    }

    return {
      classId: assignment.classId,
      visibleFromUtc,
      visibleUntilUtc,
    };
  });

  return {
    title: parsed.data.title,
    description: parsed.data.description,
    scheduleEntries,
    questions: parsed.data.questions,
  };
}

const QUIZ_INCLUDE = {
  assignments: {
    include: {
      class: {
        select: {
          id: true,
          name: true,
          blockNumber: true,
        },
      },
    },
    orderBy: { visibleFromUtc: "asc" },
  },
  questions: {
    include: {
      choices: true,
    },
    orderBy: { orderIndex: "asc" },
  },
};

const TEMPLATE_INCLUDE = {
  questions: {
    include: {
      choices: true,
    },
    orderBy: { orderIndex: "asc" },
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getUtcBoundsForLocalDay(now, timezoneOffsetMinutes) {
  const localNowMs = now.getTime() - timezoneOffsetMinutes * 60000;
  const localDayStartMs = Math.floor(localNowMs / DAY_MS) * DAY_MS;
  const utcStartMs = localDayStartMs + timezoneOffsetMinutes * 60000;
  return {
    start: new Date(utcStartMs),
    end: new Date(utcStartMs + DAY_MS),
    localDayStartMs,
  };
}

function getUtcBoundsForLocalWeek(now, timezoneOffsetMinutes) {
  const { localDayStartMs } = getUtcBoundsForLocalDay(now, timezoneOffsetMinutes);
  const localDayOfWeek = new Date(localDayStartMs).getUTCDay();
  const daysSinceMonday = (localDayOfWeek + 6) % 7;
  const localWeekStartMs = localDayStartMs - daysSinceMonday * DAY_MS;
  const utcStartMs = localWeekStartMs + timezoneOffsetMinutes * 60000;
  return {
    start: new Date(utcStartMs),
    end: new Date(utcStartMs + 7 * DAY_MS),
  };
}

function assignmentOverlapsWindow(assignment, windowStart, windowEnd) {
  const visibleFrom = new Date(assignment.visibleFromUtc);
  const visibleUntil = new Date(assignment.visibleUntilUtc);
  return visibleFrom < windowEnd && visibleUntil > windowStart;
}

function buildSummaryMetrics(quizzes, windowStart, windowEnd) {
  let activeQuizCount = 0;
  let assignedCount = 0;
  let submittedCount = 0;
  const publishable = [];

  quizzes.forEach((quiz) => {
    const matchingAssignments = quiz.assignments.filter((assignment) =>
      assignmentOverlapsWindow(assignment, windowStart, windowEnd)
    );
    if (!matchingAssignments.length) {
      return;
    }

    activeQuizCount += 1;
    const assignedStudentIds = new Set();
    matchingAssignments.forEach((assignment) => {
      assignment.class.students.forEach((student) => {
        assignedStudentIds.add(student.id);
      });
    });

    const matchingSubmittedCount = quiz.attempts.filter((attempt) =>
      assignedStudentIds.has(attempt.studentId)
    ).length;

    assignedCount += assignedStudentIds.size;
    submittedCount += matchingSubmittedCount;

    if (quiz.resultStatus !== "published" && matchingSubmittedCount > 0) {
      publishable.push({
        quizId: quiz.id,
        title: quiz.title,
        submittedCount: matchingSubmittedCount,
        assignedCount: assignedStudentIds.size,
      });
    }
  });

  return {
    activeQuizCount,
    assignedCount,
    submittedCount,
    publishable,
  };
}

function createQuizService({ prisma }) {
  if (!prisma) {
    throw new Error("createQuizService requires prisma client.");
  }

  async function listQuizzes(adminId) {
    return prisma.quiz.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      include: QUIZ_INCLUDE,
    });
  }

  async function getQuizById(adminId, quizId) {
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, adminId },
      include: QUIZ_INCLUDE,
    });
    if (!quiz) {
      throw new QuizServiceError(404, "Quiz not found.");
    }

    return quiz;
  }

  async function createDraftQuiz(adminId, payload) {
    const data = await validateAndBuildQuizData(prisma, adminId, payload);

    return prisma.quiz.create({
      data: {
        adminId,
        title: data.title,
        description: data.description,
        status: "draft",
        assignments: {
          create: data.scheduleEntries,
        },
        questions: {
          create: toQuestionCreateInput(data.questions),
        },
      },
      include: QUIZ_INCLUDE,
    });
  }

  async function listTemplates(adminId) {
    return prisma.quizTemplate.findMany({
      where: { adminId },
      orderBy: { updatedAt: "desc" },
      include: TEMPLATE_INCLUDE,
    });
  }

  async function saveQuizAsTemplate(adminId, quizId, { title } = {}) {
    if (!quizId || typeof quizId !== "string") {
      throw new QuizServiceError(400, "quizId is required.");
    }

    const sourceQuiz = await prisma.quiz.findFirst({
      where: { id: quizId, adminId },
      include: QUIZ_INCLUDE,
    });
    if (!sourceQuiz) {
      throw new QuizServiceError(404, "Quiz not found.");
    }

    return prisma.quizTemplate.create({
      data: {
        adminId,
        title: title?.trim() || sourceQuiz.title,
        description: sourceQuiz.description,
        questions: {
          create: toTemplateQuestionCreateInput(sourceQuiz.questions),
        },
      },
      include: TEMPLATE_INCLUDE,
    });
  }

  async function getTemplateById(adminId, templateId) {
    const template = await prisma.quizTemplate.findFirst({
      where: { id: templateId, adminId },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new QuizServiceError(404, "Template not found.");
    }

    return template;
  }

  async function updateDraftQuiz(adminId, quizId, payload) {
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, adminId } });
    if (!quiz) {
      throw new QuizServiceError(404, "Quiz not found.");
    }

    if (quiz.status !== "draft") {
      throw new QuizServiceError(400, "Only draft quizzes can be edited.");
    }

    const data = await validateAndBuildQuizData(prisma, adminId, payload);

    return prisma.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        description: data.description,
        assignments: {
          deleteMany: {},
          create: data.scheduleEntries,
        },
        questions: {
          deleteMany: {},
          create: toQuestionCreateInput(data.questions),
        },
      },
      include: QUIZ_INCLUDE,
    });
  }

  async function publishQuiz(adminId, quizId) {
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, adminId },
      include: QUIZ_INCLUDE,
    });
    if (!quiz) {
      throw new QuizServiceError(404, "Quiz not found.");
    }

    if (quiz.status !== "draft") {
      throw new QuizServiceError(400, "Only draft quizzes can be published.");
    }

    if (quiz.questions.length !== 5) {
      throw new QuizServiceError(400, "Quiz must have exactly 5 questions before publishing.");
    }

    if (!quiz.assignments.length) {
      throw new QuizServiceError(400, "Quiz needs at least one assigned block before publishing.");
    }

    const hasInvalidSchedule = quiz.assignments.some(
      (assignment) => new Date(assignment.visibleUntilUtc) <= new Date(assignment.visibleFromUtc)
    );
    if (hasInvalidSchedule) {
      throw new QuizServiceError(400, "Quiz has invalid assignment schedules.");
    }

    return prisma.quiz.update({
      where: { id: quizId },
      data: {
        status: "published",
        publishedAt: new Date(),
      },
      include: QUIZ_INCLUDE,
    });
  }

  async function publishResults(adminId, quizId) {
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, adminId },
      select: {
        id: true,
        status: true,
        resultStatus: true,
      },
    });
    if (!quiz) {
      throw new QuizServiceError(404, "Quiz not found.");
    }

    if (quiz.status !== "published") {
      throw new QuizServiceError(400, "Results can only be published for published quizzes.");
    }

    if (quiz.resultStatus === "published") {
      throw new QuizServiceError(400, "Results are already published.");
    }

    return prisma.quiz.update({
      where: { id: quizId },
      data: {
        resultStatus: "published",
        resultsPublishedAt: new Date(),
      },
      include: QUIZ_INCLUDE,
    });
  }

  async function duplicateQuiz(adminId, quizId) {
    const sourceQuiz = await prisma.quiz.findFirst({
      where: { id: quizId, adminId },
      include: QUIZ_INCLUDE,
    });
    if (!sourceQuiz) {
      throw new QuizServiceError(404, "Quiz not found.");
    }

    return prisma.quiz.create({
      data: {
        adminId,
        title: `${sourceQuiz.title} (Copy)`,
        description: sourceQuiz.description,
        status: "draft",
        assignments: {
          create: sourceQuiz.assignments.map((assignment) => ({
            classId: assignment.classId,
            visibleFromUtc: new Date(assignment.visibleFromUtc),
            visibleUntilUtc: new Date(assignment.visibleUntilUtc),
          })),
        },
        questions: {
          create: sourceQuiz.questions.map((question) => ({
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            choices: {
              create: question.choices.map((choice) => ({
                label: choice.label,
                text: choice.text,
                isCorrect: choice.isCorrect,
              })),
            },
          })),
        },
      },
      include: QUIZ_INCLUDE,
    });
  }

  async function getOperationsSummary(adminId, { timezoneOffsetMinutes = 0, now } = {}) {
    const currentTime = now ? new Date(now) : new Date();
    if (Number.isNaN(currentTime.getTime())) {
      throw new QuizServiceError(400, "Invalid current time.");
    }
    if (!Number.isInteger(timezoneOffsetMinutes)) {
      throw new QuizServiceError(400, "timezoneOffsetMinutes must be an integer.");
    }

    const today = getUtcBoundsForLocalDay(currentTime, timezoneOffsetMinutes);
    const thisWeek = getUtcBoundsForLocalWeek(currentTime, timezoneOffsetMinutes);
    const quizzes = await prisma.quiz.findMany({
      where: {
        adminId,
        status: "published",
      },
      select: {
        id: true,
        title: true,
        resultStatus: true,
        assignments: {
          select: {
            visibleFromUtc: true,
            visibleUntilUtc: true,
            class: {
              select: {
                students: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
        attempts: {
          select: {
            studentId: true,
          },
        },
      },
    });

    return {
      today: buildSummaryMetrics(quizzes, today.start, today.end),
      thisWeek: buildSummaryMetrics(quizzes, thisWeek.start, thisWeek.end),
    };
  }

  async function getQuizSummaryReport(adminId, { blockNumber } = {}) {
    const where = { adminId };
    if (Number.isInteger(blockNumber)) {
      where.assignments = {
        some: {
          class: { blockNumber },
        },
      };
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        resultStatus: true,
        assignments: {
          select: {
            class: {
              select: {
                id: true,
                name: true,
                blockNumber: true,
                students: {
                  select: { id: true },
                },
              },
            },
          },
        },
        attempts: {
          select: {
            score: true,
            student: {
              select: {
                id: true,
                classId: true,
              },
            },
          },
        },
      },
    });

    return quizzes.map((quiz) => {
      const matchingAssignments = Number.isInteger(blockNumber)
        ? quiz.assignments.filter((assignment) => assignment.class.blockNumber === blockNumber)
        : quiz.assignments;

      const assignedStudentIds = new Set();
      matchingAssignments.forEach((assignment) => {
        assignment.class.students.forEach((student) => {
          assignedStudentIds.add(student.id);
        });
      });

      const matchingAttempts = quiz.attempts.filter((attempt) => {
        if (Number.isInteger(blockNumber)) {
          return matchingAssignments.some(
            (assignment) => assignment.class.id === attempt.student.classId
          );
        }
        return assignedStudentIds.has(attempt.student.id);
      });

      const submittedCount = matchingAttempts.length;
      const averageScore = submittedCount
        ? matchingAttempts.reduce((total, attempt) => total + attempt.score, 0) / submittedCount
        : null;

      return {
        quizId: quiz.id,
        title: quiz.title,
        status: quiz.status,
        resultStatus: quiz.resultStatus,
        assignedCount: assignedStudentIds.size,
        submittedCount,
        averageScore,
        blockNumbers: [
          ...new Set(matchingAssignments.map((assignment) => assignment.class.blockNumber)),
        ],
      };
    });
  }

  async function getGradebookReport(adminId, { classId, quizId, weekStart } = {}) {
    if (classId) {
      const ownedClass = await prisma.class.findFirst({
        where: { id: classId, adminId },
        select: { id: true },
      });
      if (!ownedClass) {
        throw new QuizServiceError(404, "Class not found.");
      }
    }

    if (quizId) {
      const ownedQuiz = await prisma.quiz.findFirst({
        where: { id: quizId, adminId },
        select: { id: true },
      });
      if (!ownedQuiz) {
        throw new QuizServiceError(404, "Quiz not found.");
      }
    }

    let weekStartUtc;
    let weekEndUtc;
    if (weekStart) {
      const parsed = new Date(`${weekStart}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        throw new QuizServiceError(400, "weekStart must be a valid YYYY-MM-DD date.");
      }

      weekStartUtc = parsed;
      weekEndUtc = new Date(parsed.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        adminId,
        ...(quizId ? { id: quizId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        assignments: {
          where: {
            ...(classId ? { classId } : {}),
            ...(weekStartUtc
              ? {
                  visibleFromUtc: {
                    gte: weekStartUtc,
                    lt: weekEndUtc,
                  },
                }
              : {}),
          },
          select: {
            classId: true,
            visibleUntilUtc: true,
            class: {
              select: {
                id: true,
                name: true,
                blockNumber: true,
                students: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
        attempts: {
          select: {
            studentId: true,
            score: true,
            maxScore: true,
            submittedAt: true,
            late: true,
          },
        },
      },
    });

    const rows = [];
    quizzes.forEach((quiz) => {
      const attemptByStudentId = new Map(
        quiz.attempts.map((attempt) => [attempt.studentId, attempt])
      );

      quiz.assignments.forEach((assignment) => {
        assignment.class.students.forEach((student) => {
          const attempt = attemptByStudentId.get(student.id) || null;
          const score = attempt?.score ?? null;
          const maxScore = attempt?.maxScore ?? null;
          const percent =
            score !== null && maxScore ? Math.round((score / maxScore) * 10000) / 100 : null;

          rows.push({
            studentId: student.id,
            username: student.username,
            classId: assignment.class.id,
            className: assignment.class.name,
            blockNumber: assignment.class.blockNumber,
            quizId: quiz.id,
            quizTitle: quiz.title,
            status: attempt ? "submitted" : "missing",
            score,
            maxScore,
            percent,
            submittedAt: attempt?.submittedAt ?? null,
            late: attempt
              ? (attempt.late ??
                new Date(attempt.submittedAt) > new Date(assignment.visibleUntilUtc))
              : false,
          });
        });
      });
    });

    rows.sort((left, right) => {
      const usernameOrder = left.username.localeCompare(right.username);
      if (usernameOrder !== 0) {
        return usernameOrder;
      }

      return left.quizTitle.localeCompare(right.quizTitle);
    });

    return rows;
  }

  return {
    createDraftQuiz,
    duplicateQuiz,
    getTemplateById,
    getQuizById,
    getOperationsSummary,
    listTemplates,
    listQuizzes,
    getGradebookReport,
    getQuizSummaryReport,
    publishResults,
    publishQuiz,
    saveQuizAsTemplate,
    updateDraftQuiz,
  };
}

module.exports = {
  QuizServiceError,
  createQuizService,
};
