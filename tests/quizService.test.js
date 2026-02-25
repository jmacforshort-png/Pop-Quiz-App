const { QuizServiceError, createQuizService } = require("../src/server/quizService");

function validQuizPayload() {
  return {
    title: "Unit 1 Quiz",
    description: "Five-question check",
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
  return {
    quiz: {
      create: async ({ data }) => {
        return {
          id: "quiz_1",
          ...data,
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
});
