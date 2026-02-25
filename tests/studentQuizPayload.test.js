const {
  StudentQuizServiceError,
  createStudentQuizService,
} = require("../src/server/studentQuizService");

function createPrismaMock() {
  return {
    quiz: {
      findFirst: async ({ where }) => {
        if (where.id !== "quiz_1" || where.assignments.some.classId !== "class_1") {
          return null;
        }

        return {
          id: "quiz_1",
          title: "Published Quiz",
          description: "Visible quiz",
          questions: [
            {
              id: "question_1",
              orderIndex: 1,
              prompt: "Question 1",
              choices: [
                { id: "choice_a", label: "A", text: "Option A" },
                { id: "choice_b", label: "B", text: "Option B" },
                { id: "choice_c", label: "C", text: "Option C" },
                { id: "choice_d", label: "D", text: "Option D" },
              ],
            },
          ],
        };
      },
    },
  };
}

describe("student safe quiz payload", () => {
  it("returns student-safe quiz payload with no answer key", async () => {
    const prisma = createPrismaMock();
    const service = createStudentQuizService({ prisma });

    const quiz = await service.getQuizForStudent({
      classId: "class_1",
      quizId: "quiz_1",
      now: new Date("2026-02-25T18:00:00.000Z"),
    });

    expect(quiz.id).toBe("quiz_1");
    expect(quiz.questions[0].choices[0]).not.toHaveProperty("isCorrect");
  });

  it("rejects unavailable quiz", async () => {
    const prisma = createPrismaMock();
    const service = createStudentQuizService({ prisma });

    await expect(
      service.getQuizForStudent({ classId: "class_1", quizId: "missing", now: new Date() })
    ).rejects.toBeInstanceOf(StudentQuizServiceError);
  });
});
