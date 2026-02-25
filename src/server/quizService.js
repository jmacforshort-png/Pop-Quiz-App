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

    return prisma.quiz.create({
      data: {
        adminId,
        title: parsed.data.title,
        description: parsed.data.description,
        status: "draft",
        questions: {
          create: toQuestionCreateInput(parsed.data.questions),
        },
      },
      include: {
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
