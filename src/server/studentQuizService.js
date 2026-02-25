class StudentQuizServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function createStudentQuizService({ prisma }) {
  if (!prisma) {
    throw new Error("createStudentQuizService requires prisma client.");
  }

  async function listAvailableQuizzes({ classId, now = new Date() }) {
    if (!classId) {
      throw new StudentQuizServiceError(400, "Student class is required.");
    }

    return prisma.quiz.findMany({
      where: {
        status: "published",
        assignments: {
          some: {
            classId,
            visibleFromUtc: { lte: now },
            visibleUntilUtc: { gt: now },
          },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        publishedAt: true,
        assignments: {
          where: {
            classId,
          },
          select: {
            classId: true,
            visibleFromUtc: true,
            visibleUntilUtc: true,
            class: {
              select: {
                name: true,
                blockNumber: true,
              },
            },
          },
        },
      },
    });
  }

  async function getQuizForStudent({ classId, quizId, now = new Date() }) {
    if (!classId) {
      throw new StudentQuizServiceError(400, "Student class is required.");
    }

    const quiz = await prisma.quiz.findFirst({
      where: {
        id: quizId,
        status: "published",
        assignments: {
          some: {
            classId,
            visibleFromUtc: { lte: now },
            visibleUntilUtc: { gt: now },
          },
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            orderIndex: true,
            prompt: true,
            choices: {
              orderBy: { label: "asc" },
              select: {
                id: true,
                label: true,
                text: true,
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new StudentQuizServiceError(404, "Quiz not found or not currently available.");
    }

    return quiz;
  }

  return {
    getQuizForStudent,
    listAvailableQuizzes,
  };
}

module.exports = {
  StudentQuizServiceError,
  createStudentQuizService,
};
