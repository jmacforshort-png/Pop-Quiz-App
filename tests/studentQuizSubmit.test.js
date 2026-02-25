const {
  StudentQuizServiceError,
  createStudentQuizService,
} = require("../src/server/studentQuizService");

function createSubmissionPrismaMock() {
  return {
    quiz: {
      findFirst: async ({ where }) => {
        if (where.id !== "quiz_1" || where.assignments.some.classId !== "class_1") {
          return null;
        }

        return {
          id: "quiz_1",
          questions: [
            {
              id: "q1",
              choices: [
                { label: "A", isCorrect: true },
                { label: "B", isCorrect: false },
                { label: "C", isCorrect: false },
                { label: "D", isCorrect: false },
              ],
            },
            {
              id: "q2",
              choices: [
                { label: "A", isCorrect: false },
                { label: "B", isCorrect: true },
                { label: "C", isCorrect: false },
                { label: "D", isCorrect: false },
              ],
            },
          ],
        };
      },
    },
    attempt: {
      create: async ({ data }) => ({
        id: "attempt_1",
        score: data.score,
        maxScore: data.maxScore,
        submittedAt: data.submittedAt,
      }),
    },
  };
}

describe("student quiz submission", () => {
  it("grades and stores attempt", async () => {
    const prisma = createSubmissionPrismaMock();
    const service = createStudentQuizService({ prisma });

    const attempt = await service.submitQuizAttempt({
      classId: "class_1",
      quizId: "quiz_1",
      studentId: "student_1",
      now: new Date("2026-02-25T18:00:00.000Z"),
      answers: [
        { questionId: "q1", selectedLabel: "A" },
        { questionId: "q2", selectedLabel: "C" },
      ],
    });

    expect(attempt.id).toBe("attempt_1");
    expect(attempt.score).toBe(1);
    expect(attempt.maxScore).toBe(2);
  });

  it("rejects incomplete answer sets", async () => {
    const prisma = createSubmissionPrismaMock();
    const service = createStudentQuizService({ prisma });

    await expect(
      service.submitQuizAttempt({
        classId: "class_1",
        quizId: "quiz_1",
        studentId: "student_1",
        answers: [{ questionId: "q1", selectedLabel: "A" }],
      })
    ).rejects.toBeInstanceOf(StudentQuizServiceError);
  });

  it("rejects invalid quiz access", async () => {
    const prisma = createSubmissionPrismaMock();
    const service = createStudentQuizService({ prisma });

    await expect(
      service.submitQuizAttempt({
        classId: "class_1",
        quizId: "missing",
        studentId: "student_1",
        answers: [
          { questionId: "q1", selectedLabel: "A" },
          { questionId: "q2", selectedLabel: "B" },
        ],
      })
    ).rejects.toBeInstanceOf(StudentQuizServiceError);
  });
});
