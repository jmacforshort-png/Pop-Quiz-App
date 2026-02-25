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

  return {
    createDraftQuiz,
    getQuizById,
    listQuizzes,
    getQuizSummaryReport,
    publishResults,
    publishQuiz,
    updateDraftQuiz,
  };
}

module.exports = {
  QuizServiceError,
  createQuizService,
};
