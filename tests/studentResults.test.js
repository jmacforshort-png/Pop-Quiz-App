const { createStudentQuizService } = require("../src/server/studentQuizService");

function createPrismaMock() {
  return {
    attempt: {
      findMany: async ({ where }) => {
        if (where.studentId !== "student_1") {
          return [];
        }

        return [
          {
            id: "attempt_1",
            submittedAt: new Date("2026-02-25T18:00:00.000Z"),
            score: 4,
            maxScore: 5,
            quiz: {
              id: "quiz_1",
              title: "Unit 1 Quiz",
              resultStatus: "hidden",
              resultsPublishedAt: null,
            },
          },
          {
            id: "attempt_2",
            submittedAt: new Date("2026-02-25T19:00:00.000Z"),
            score: 5,
            maxScore: 5,
            quiz: {
              id: "quiz_2",
              title: "Unit 2 Quiz",
              resultStatus: "published",
              resultsPublishedAt: new Date("2026-02-25T20:00:00.000Z"),
            },
          },
        ];
      },
    },
  };
}

describe("student results service", () => {
  it("hides score for hidden results and returns score for published results", async () => {
    const service = createStudentQuizService({ prisma: createPrismaMock() });

    const results = await service.listStudentResults({ studentId: "student_1" });

    expect(results).toHaveLength(2);
    expect(results[0].resultStatus).toBe("hidden");
    expect(results[0].score).toBeNull();
    expect(results[1].resultStatus).toBe("published");
    expect(results[1].score).toBe(5);
  });
});
