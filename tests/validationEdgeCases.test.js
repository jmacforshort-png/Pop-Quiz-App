const { AuthServiceError, createAuthService } = require("../src/server/authService");
const { QuizServiceError, createQuizService } = require("../src/server/quizService");

function createAuthPrismaMock() {
  const users = [];
  return {
    user: {
      create: async ({ data }) => {
        if (users.some((user) => user.usernameNormalized === data.usernameNormalized)) {
          const error = new Error("Unique constraint failed.");
          error.code = "P2002";
          throw error;
        }

        const user = {
          id: `user_${users.length + 1}`,
          username: data.username,
          usernameNormalized: data.usernameNormalized,
          passwordHash: data.passwordHash,
          role: data.role,
          classId: data.classId,
        };
        users.push(user);
        return user;
      },
      findUnique: async ({ where }) =>
        users.find((user) => user.usernameNormalized === where.usernameNormalized) ?? null,
    },
    class: {
      findFirst: async ({ where }) =>
        where.blockNumber === 1 ? { id: "class_1", blockNumber: 1 } : null,
    },
  };
}

function createQuizPrismaMock() {
  return {
    class: {
      findMany: async ({ where }) => where.id.in.map((id) => ({ id })),
    },
    quiz: {
      create: async () => ({ id: "quiz_1" }),
    },
  };
}

function validPayload() {
  return {
    title: "Validation Quiz",
    assignments: [
      {
        classId: "class_1",
        visibleFromUtc: "2026-02-25T18:00:00.000Z",
        visibleUntilUtc: "2026-02-25T19:00:00.000Z",
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

describe("validation edge cases", () => {
  it("rejects duplicate usernames after normalization", async () => {
    const authService = createAuthService({
      prisma: createAuthPrismaMock(),
      jwtSecret: "test-secret",
    });

    await authService.signup({
      username: " Student_One ",
      password: "secret1",
      blockNumber: 1,
    });

    await expect(
      authService.signup({
        username: "student_one",
        password: "secret2",
        blockNumber: 1,
      })
    ).rejects.toBeInstanceOf(AuthServiceError);
  });

  it("rejects short passwords", async () => {
    const authService = createAuthService({
      prisma: createAuthPrismaMock(),
      jwtSecret: "test-secret",
    });

    await expect(
      authService.signup({
        username: "student_two",
        password: "12345",
        blockNumber: 1,
      })
    ).rejects.toBeInstanceOf(AuthServiceError);
  });

  it("rejects invalid quiz shape", async () => {
    const quizService = createQuizService({ prisma: createQuizPrismaMock() });
    const payload = validPayload();
    payload.questions[0].choices = [
      { label: "A", text: "Option A", isCorrect: false },
      { label: "A", text: "Option A2", isCorrect: true },
      { label: "C", text: "Option C", isCorrect: false },
      { label: "D", text: "Option D", isCorrect: false },
    ];

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toBeInstanceOf(
      QuizServiceError
    );
  });

  it("rejects invalid quiz schedules", async () => {
    const quizService = createQuizService({ prisma: createQuizPrismaMock() });
    const payload = validPayload();
    payload.assignments[0].visibleUntilUtc = "2026-02-25T17:59:00.000Z";

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toBeInstanceOf(
      QuizServiceError
    );
  });
});
