const { QuizServiceError, createQuizService } = require("../src/server/quizService");

function validQuizPayload() {
  return {
    title: "Unit 1 Quiz",
    description: "Five-question check",
    assignments: [
      {
        classId: "class_1",
        visibleFromUtc: "2026-02-25T18:00:00.000Z",
        visibleUntilUtc: "2026-02-25T19:00:00.000Z",
      },
      {
        classId: "class_2",
        visibleFromUtc: "2026-02-25T20:00:00.000Z",
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

function createQuizPrismaMock() {
  const classes = [
    { id: "class_1", adminId: "admin_1" },
    { id: "class_2", adminId: "admin_1" },
    { id: "class_3", adminId: "admin_2" },
  ];

  return {
    class: {
      findMany: async ({ where }) => {
        return classes
          .filter((item) => item.adminId === where.adminId)
          .filter((item) => where.id.in.includes(item.id))
          .map((item) => ({ id: item.id }));
      },
    },
    quiz: {
      create: async ({ data }) => {
        return {
          id: "quiz_1",
          ...data,
          assignments: data.assignments.create,
          questions: data.questions.create.map((question) => ({
            id: `question_${question.orderIndex}`,
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            choices: question.choices.create,
          })),
        };
      },
    },
  };
}

describe("quiz service", () => {
  it("creates draft quiz with nested questions and choices", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });

    const quiz = await quizService.createDraftQuiz("admin_1", validQuizPayload());

    expect(quiz.title).toBe("Unit 1 Quiz");
    expect(quiz.status).toBe("draft");
    expect(quiz.assignments).toHaveLength(2);
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.questions[0].orderIndex).toBe(1);
    expect(quiz.questions[0].choices).toHaveLength(4);
  });

  it("rejects invalid fixed quiz structure", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const payload = validQuizPayload();
    payload.questions.pop();

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toBeInstanceOf(
      QuizServiceError
    );
  });

  it("requires title", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const payload = validQuizPayload();
    payload.title = "";

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("requires at least one assigned block", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const payload = validQuizPayload();
    payload.assignments = [];

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects assignment not owned by admin", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const payload = validQuizPayload();
    payload.assignments = [
      {
        classId: "class_3",
        visibleFromUtc: "2026-02-25T18:00:00.000Z",
        visibleUntilUtc: "2026-02-25T19:00:00.000Z",
      },
    ];

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("rejects invalid assignment schedule", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const payload = validQuizPayload();
    payload.assignments[0].visibleUntilUtc = payload.assignments[0].visibleFromUtc;

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
