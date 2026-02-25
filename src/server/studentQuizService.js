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

  async function submitQuizAttempt({ classId, quizId, studentId, answers, now = new Date() }) {
    if (!classId || !studentId) {
      throw new StudentQuizServiceError(400, "Student identity is required.");
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      throw new StudentQuizServiceError(400, "Answer payload is required.");
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
        resultStatus: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            choices: {
              select: {
                label: true,
                isCorrect: true,
              },
            },
          },
        },
      },
    });
    if (!quiz) {
      throw new StudentQuizServiceError(404, "Quiz not found or not currently available.");
    }

    if (answers.length !== quiz.questions.length) {
      throw new StudentQuizServiceError(400, "Answers must be provided for every question.");
    }

    const answerMap = new Map();
    for (const answer of answers) {
      if (!answer?.questionId || !answer?.selectedLabel) {
        throw new StudentQuizServiceError(
          400,
          "Each answer requires questionId and selectedLabel."
        );
      }
      if (answerMap.has(answer.questionId)) {
        throw new StudentQuizServiceError(400, "Duplicate answers for a question are not allowed.");
      }
      answerMap.set(answer.questionId, answer.selectedLabel);
    }

    const gradedAnswers = quiz.questions.map((question) => {
      const selectedLabel = answerMap.get(question.id);
      if (!selectedLabel) {
        throw new StudentQuizServiceError(400, "Missing answers for one or more questions.");
      }

      const selectedChoice = question.choices.find((choice) => choice.label === selectedLabel);
      if (!selectedChoice) {
        throw new StudentQuizServiceError(400, "Selected answer label is invalid.");
      }

      return {
        questionId: question.id,
        selectedLabel,
        isCorrect: selectedChoice.isCorrect,
      };
    });

    const score = gradedAnswers.filter((answer) => answer.isCorrect).length;

    const attempt = await prisma.attempt.create({
      data: {
        quizId,
        studentId,
        submittedAt: now,
        score,
        maxScore: quiz.questions.length,
        status: "submitted",
        answers: {
          create: gradedAnswers,
        },
      },
      select: {
        id: true,
        score: true,
        maxScore: true,
        submittedAt: true,
      },
    });

    return {
      id: attempt.id,
      submittedAt: attempt.submittedAt,
      resultStatus: quiz.resultStatus,
      score: quiz.resultStatus === "published" ? attempt.score : null,
      maxScore: attempt.maxScore,
    };
  }

  return {
    getQuizForStudent,
    listAvailableQuizzes,
    submitQuizAttempt,
  };
}

module.exports = {
  StudentQuizServiceError,
  createStudentQuizService,
};
