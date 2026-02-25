const { createAuthService } = require("../src/server/authService");
const { createClassService } = require("../src/server/classService");
const { createQuizService } = require("../src/server/quizService");
const { createStudentQuizService } = require("../src/server/studentQuizService");

function createWorkflowPrisma() {
  const classes = [];
  const users = [];
  const quizzes = [];
  const attempts = [];

  let classCounter = 1;
  let userCounter = 1;
  let quizCounter = 1;
  let questionCounter = 1;
  let choiceCounter = 1;
  let attemptCounter = 1;

  function matchesAssignmentWindow(assignment, where) {
    const classMatch = !where.classId || assignment.classId === where.classId;
    const fromMatch =
      !where.visibleFromUtc?.lte || assignment.visibleFromUtc <= where.visibleFromUtc.lte;
    const untilMatch =
      !where.visibleUntilUtc?.gt || assignment.visibleUntilUtc > where.visibleUntilUtc.gt;
    return classMatch && fromMatch && untilMatch;
  }

  return {
    class: {
      findFirst: async ({ where }) => {
        if (where.blockNumber) {
          return classes.find((item) => item.blockNumber === where.blockNumber) ?? null;
        }
        if (where.id && where.adminId) {
          return (
            classes.find((item) => item.id === where.id && item.adminId === where.adminId) ?? null
          );
        }
        return null;
      },
      findMany: async ({ where }) =>
        classes
          .filter((item) => (where.adminId ? item.adminId === where.adminId : true))
          .filter((item) => (where.id?.in ? where.id.in.includes(item.id) : true))
          .sort((a, b) => a.blockNumber - b.blockNumber),
      create: async ({ data }) => {
        const item = {
          id: `class_${classCounter++}`,
          adminId: data.adminId,
          name: data.name,
          blockNumber: data.blockNumber,
          createdAt: new Date(),
        };
        classes.push(item);
        return item;
      },
      update: async ({ where, data }) => {
        const item = classes.find((classItem) => classItem.id === where.id);
        item.name = data.name;
        item.blockNumber = data.blockNumber;
        return item;
      },
      delete: async ({ where }) => {
        const index = classes.findIndex((item) => item.id === where.id);
        if (index >= 0) {
          classes.splice(index, 1);
        }
      },
    },
    user: {
      create: async ({ data }) => {
        if (users.some((user) => user.usernameNormalized === data.usernameNormalized)) {
          const error = new Error("Unique constraint failed.");
          error.code = "P2002";
          throw error;
        }
        const user = {
          id: `user_${userCounter++}`,
          username: data.username,
          usernameNormalized: data.usernameNormalized,
          passwordHash: data.passwordHash,
          role: data.role,
          classId: data.classId ?? null,
        };
        users.push(user);
        return user;
      },
      findUnique: async ({ where }) =>
        users.find((user) => user.usernameNormalized === where.usernameNormalized) ?? null,
    },
    quiz: {
      create: async ({ data }) => {
        const quizId = `quiz_${quizCounter++}`;
        const quiz = {
          id: quizId,
          adminId: data.adminId,
          title: data.title,
          description: data.description ?? null,
          status: data.status ?? "draft",
          resultStatus: "hidden",
          publishedAt: null,
          resultsPublishedAt: null,
          assignments: data.assignments.create.map((assignment) => ({
            classId: assignment.classId,
            visibleFromUtc: assignment.visibleFromUtc,
            visibleUntilUtc: assignment.visibleUntilUtc,
            class: classes.find((classItem) => classItem.id === assignment.classId),
          })),
          questions: data.questions.create.map((question) => ({
            id: `question_${questionCounter++}`,
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            choices: question.choices.create.map((choice) => ({
              id: `choice_${choiceCounter++}`,
              label: choice.label,
              text: choice.text,
              isCorrect: choice.isCorrect,
            })),
          })),
          attempts: [],
        };
        quizzes.push(quiz);
        return quiz;
      },
      findMany: async ({ where }) =>
        quizzes
          .filter((quiz) => (where.adminId ? quiz.adminId === where.adminId : true))
          .filter((quiz) => (where.status ? quiz.status === where.status : true))
          .filter((quiz) => {
            if (!where.assignments?.some) {
              return true;
            }
            return quiz.assignments.some((assignment) =>
              matchesAssignmentWindow(assignment, where.assignments.some)
            );
          })
          .map((quiz) => ({
            ...quiz,
            assignments: quiz.assignments.map((assignment) => ({
              ...assignment,
              class: assignment.class,
            })),
          })),
      findFirst: async ({ where }) => {
        const quiz =
          quizzes.find((item) => {
            if (where.id && item.id !== where.id) {
              return false;
            }
            if (where.adminId && item.adminId !== where.adminId) {
              return false;
            }
            if (where.status && item.status !== where.status) {
              return false;
            }
            if (where.assignments?.some) {
              return item.assignments.some((assignment) =>
                matchesAssignmentWindow(assignment, where.assignments.some)
              );
            }
            return true;
          }) ?? null;

        if (!quiz) {
          return null;
        }

        return {
          ...quiz,
          assignments: quiz.assignments,
          questions: quiz.questions.map((question) => ({
            ...question,
            choices: question.choices.map((choice) => ({ ...choice })),
          })),
        };
      },
      update: async ({ where, data }) => {
        const quiz = quizzes.find((item) => item.id === where.id);
        if (data.status) {
          quiz.status = data.status;
        }
        if (data.publishedAt) {
          quiz.publishedAt = data.publishedAt;
        }
        if (data.resultStatus) {
          quiz.resultStatus = data.resultStatus;
        }
        if (data.resultsPublishedAt) {
          quiz.resultsPublishedAt = data.resultsPublishedAt;
        }
        return quiz;
      },
    },
    attempt: {
      create: async ({ data }) => {
        const attempt = {
          id: `attempt_${attemptCounter++}`,
          quizId: data.quizId,
          studentId: data.studentId,
          submittedAt: data.submittedAt,
          score: data.score,
          maxScore: data.maxScore,
          answers: data.answers.create,
        };
        attempts.push(attempt);

        const quiz = quizzes.find((item) => item.id === data.quizId);
        if (quiz) {
          quiz.attempts.push(attempt);
        }
        return {
          id: attempt.id,
          submittedAt: attempt.submittedAt,
          score: attempt.score,
          maxScore: attempt.maxScore,
        };
      },
      findMany: async ({ where }) =>
        attempts
          .filter((attempt) => attempt.studentId === where.studentId)
          .map((attempt) => {
            const quiz = quizzes.find((item) => item.id === attempt.quizId);
            return {
              id: attempt.id,
              submittedAt: attempt.submittedAt,
              score: attempt.score,
              maxScore: attempt.maxScore,
              quiz: {
                id: quiz.id,
                title: quiz.title,
                resultStatus: quiz.resultStatus,
                resultsPublishedAt: quiz.resultsPublishedAt,
              },
            };
          }),
    },
  };
}

function buildQuizPayload(classId) {
  return {
    title: "Unit Quiz",
    assignments: [
      {
        classId,
        visibleFromUtc: "2026-02-25T17:00:00.000Z",
        visibleUntilUtc: "2026-02-25T21:00:00.000Z",
      },
    ],
    questions: Array.from({ length: 5 }, (_, index) => ({
      prompt: `Question ${index + 1}`,
      choices: [
        { label: "A", text: "Option A", isCorrect: true },
        { label: "B", text: "Option B", isCorrect: false },
        { label: "C", text: "Option C", isCorrect: false },
        { label: "D", text: "Option D", isCorrect: false },
      ],
    })),
  };
}

describe("workflow e2e", () => {
  it("supports class + quiz + signup + submit + publish-results flow", async () => {
    const prisma = createWorkflowPrisma();
    const classService = createClassService({ prisma });
    const quizService = createQuizService({ prisma });
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });
    const studentQuizService = createStudentQuizService({ prisma });

    const classItem = await classService.createClass("admin_1", {
      name: "Biology",
      blockNumber: 1,
    });

    const draft = await quizService.createDraftQuiz("admin_1", buildQuizPayload(classItem.id));
    const publishedQuiz = await quizService.publishQuiz("admin_1", draft.id);
    expect(publishedQuiz.status).toBe("published");

    const signup = await authService.signup({
      username: "student_e2e",
      password: "secret1",
      blockNumber: 1,
    });

    const available = await studentQuizService.listAvailableQuizzes({
      classId: signup.user.classId,
      now: new Date("2026-02-25T18:00:00.000Z"),
    });
    expect(available).toHaveLength(1);

    const quiz = await studentQuizService.getQuizForStudent({
      classId: signup.user.classId,
      quizId: draft.id,
      now: new Date("2026-02-25T18:00:00.000Z"),
    });
    expect(quiz.questions).toHaveLength(5);

    const attempt = await studentQuizService.submitQuizAttempt({
      classId: signup.user.classId,
      quizId: draft.id,
      studentId: signup.user.id,
      now: new Date("2026-02-25T18:05:00.000Z"),
      answers: quiz.questions.map((question) => ({
        questionId: question.id,
        selectedLabel: "A",
      })),
    });
    expect(attempt.resultStatus).toBe("hidden");
    expect(attempt.score).toBeNull();

    const beforeRelease = await studentQuizService.listStudentResults({
      studentId: signup.user.id,
    });
    expect(beforeRelease[0].resultStatus).toBe("hidden");
    expect(beforeRelease[0].score).toBeNull();

    await quizService.publishResults("admin_1", draft.id);

    const afterRelease = await studentQuizService.listStudentResults({
      studentId: signup.user.id,
    });
    expect(afterRelease[0].resultStatus).toBe("published");
    expect(afterRelease[0].score).toBe(5);
  });
});
