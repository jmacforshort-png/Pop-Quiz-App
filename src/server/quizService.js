const { baseQuizSchema } = require("./quizSchemas");
const { validateFixedQuizPayload } = require("../validation/quizPayload");

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

function createQuizService({ prisma }) {
  if (!prisma) {
    throw new Error("createQuizService requires prisma client.");
  }

  async function createDraftQuiz(adminId, payload) {
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
      const visibleFromUtc = new Date(assignment.visibleFromUtc);
      const visibleUntilUtc = new Date(assignment.visibleUntilUtc);

      if (
        Number.isNaN(visibleFromUtc.getTime()) ||
        Number.isNaN(visibleUntilUtc.getTime()) ||
        visibleUntilUtc <= visibleFromUtc
      ) {
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

    return prisma.quiz.create({
      data: {
        adminId,
        title: parsed.data.title,
        description: parsed.data.description,
        status: "draft",
        assignments: {
          create: scheduleEntries,
        },
        questions: {
          create: toQuestionCreateInput(parsed.data.questions),
        },
      },
      include: {
        assignments: true,
        questions: {
          include: {
            choices: true,
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  return {
    createDraftQuiz,
  };
}

module.exports = {
  QuizServiceError,
  createQuizService,
};
