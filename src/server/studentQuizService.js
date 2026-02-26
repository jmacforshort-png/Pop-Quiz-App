class StudentQuizServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function parseMaybeDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new StudentQuizServiceError(400, `${fieldName} must be a valid ISO timestamp.`);
  }

  return parsed;
}

function createStudentQuizService({ prisma }) {
  if (!prisma) {
    throw new Error("createStudentQuizService requires prisma client.");
  }

  async function listAvailableQuizzes({ classId, studentId, now = new Date() }) {
    if (!classId || !studentId) {
      throw new StudentQuizServiceError(400, "Student identity is required.");
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
        attempts: {
          none: {
            studentId,
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

  async function getQuizForStudent({ classId, quizId, studentId, now = new Date() }) {
    if (!classId || !studentId) {
      throw new StudentQuizServiceError(400, "Student identity is required.");
    }

    const existingAttempt = await prisma.attempt.findFirst({
      where: {
        quizId,
        studentId,
      },
      select: { id: true },
    });
    if (existingAttempt) {
      throw new StudentQuizServiceError(409, "You have already submitted this quiz.");
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

  async function listQuizFeed({ classId, studentId, now = new Date() }) {
    if (!classId || !studentId) {
      throw new StudentQuizServiceError(400, "Student identity is required.");
    }

    const quizzes = await prisma.quiz.findMany({
      where: {
        status: "published",
        assignments: {
          some: {
            classId,
          },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        assignments: {
          where: {
            classId,
          },
          select: {
            visibleFromUtc: true,
            visibleUntilUtc: true,
            class: {
              select: {
                name: true,
                blockNumber: true,
              },
            },
          },
          take: 1,
        },
        attempts: {
          where: {
            studentId,
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    return quizzes.map((quiz) => {
      const assignment = quiz.assignments[0];
      const hasAttempt = quiz.attempts.length > 0;
      let availabilityStatus = "available";
      if (hasAttempt) {
        availabilityStatus = "submitted";
      } else if (assignment && new Date(now) < new Date(assignment.visibleFromUtc)) {
        availabilityStatus = "upcoming";
      } else if (assignment && new Date(now) >= new Date(assignment.visibleUntilUtc)) {
        availabilityStatus = "closed";
      }

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        assignment: assignment || null,
        availabilityStatus,
        hasSubmitted: hasAttempt,
      };
    });
  }

  async function submitQuizAttempt({
    classId,
    quizId,
    studentId,
    answers,
    startedAt,
    now = new Date(),
  }) {
    if (!classId || !studentId) {
      throw new StudentQuizServiceError(400, "Student identity is required.");
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      throw new StudentQuizServiceError(400, "Answer payload is required.");
    }

    const existingAttempt = await prisma.attempt.findFirst({
      where: {
        quizId,
        studentId,
      },
      select: { id: true },
    });
    if (existingAttempt) {
      throw new StudentQuizServiceError(409, "You have already submitted this quiz.");
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
        assignments: {
          where: { classId },
          select: { visibleUntilUtc: true },
          take: 1,
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
    const parsedStartedAt = parseMaybeDate(startedAt, "startedAt");
    const submittedAt = now;
    const visibleUntilUtc = quiz.assignments?.[0]?.visibleUntilUtc || null;
    const late = visibleUntilUtc ? submittedAt > new Date(visibleUntilUtc) : false;

    let attempt;
    try {
      attempt = await prisma.attempt.create({
        data: {
          quizId,
          studentId,
          startedAt: parsedStartedAt,
          submittedAt,
          late,
          score,
          maxScore: quiz.questions.length,
          status: "submitted",
          answers: {
            create: gradedAnswers,
          },
        },
        select: {
          id: true,
          startedAt: true,
          score: true,
          maxScore: true,
          late: true,
          submittedAt: true,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new StudentQuizServiceError(409, "You have already submitted this quiz.");
      }
      throw error;
    }

    return {
      id: attempt.id,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      resultStatus: quiz.resultStatus,
      score: quiz.resultStatus === "published" ? attempt.score : null,
      maxScore: attempt.maxScore,
      late: attempt.late,
    };
  }

  async function listStudentResults({ studentId }) {
    if (!studentId) {
      throw new StudentQuizServiceError(400, "Student identity is required.");
    }

    const attempts = await prisma.attempt.findMany({
      where: { studentId },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        submittedAt: true,
        score: true,
        maxScore: true,
        quiz: {
          select: {
            id: true,
            title: true,
            resultStatus: true,
            resultsPublishedAt: true,
          },
        },
      },
    });

    return attempts.map((attempt) => ({
      id: attempt.id,
      quizId: attempt.quiz.id,
      quizTitle: attempt.quiz.title,
      submittedAt: attempt.submittedAt,
      resultStatus: attempt.quiz.resultStatus,
      resultsPublishedAt: attempt.quiz.resultsPublishedAt,
      score: attempt.quiz.resultStatus === "published" ? attempt.score : null,
      maxScore: attempt.maxScore,
    }));
  }

  return {
    getQuizForStudent,
    listQuizFeed,
    listStudentResults,
    listAvailableQuizzes,
    submitQuizAttempt,
  };
}

module.exports = {
  StudentQuizServiceError,
  createStudentQuizService,
};
