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

  return {
    listAvailableQuizzes,
  };
}

module.exports = {
  StudentQuizServiceError,
  createStudentQuizService,
};
