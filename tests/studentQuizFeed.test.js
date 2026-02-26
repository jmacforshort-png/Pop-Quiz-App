const {
  StudentQuizServiceError,
  createStudentQuizService,
} = require("../src/server/studentQuizService");

function createStudentQuizPrismaMock() {
  const quizzes = [
    {
      id: "quiz_open",
      title: "Open Quiz",
      description: "Visible now",
      status: "published",
      publishedAt: new Date("2026-02-25T18:00:00.000Z"),
      assignments: [
        {
          classId: "class_1",
          visibleFromUtc: new Date("2026-02-25T17:00:00.000Z"),
          visibleUntilUtc: new Date("2026-02-25T19:00:00.000Z"),
          class: { name: "Biology", blockNumber: 1 },
        },
      ],
    },
    {
      id: "quiz_closed",
      title: "Closed Quiz",
      description: "Out of window",
      status: "published",
      publishedAt: new Date("2026-02-25T16:00:00.000Z"),
      assignments: [
        {
          classId: "class_1",
          visibleFromUtc: new Date("2026-02-25T15:00:00.000Z"),
          visibleUntilUtc: new Date("2026-02-25T16:00:00.000Z"),
          class: { name: "Biology", blockNumber: 1 },
        },
      ],
    },
    {
      id: "quiz_other_class",
      title: "Other Class Quiz",
      description: "Wrong class",
      status: "published",
      publishedAt: new Date("2026-02-25T18:00:00.000Z"),
      assignments: [
        {
          classId: "class_2",
          visibleFromUtc: new Date("2026-02-25T17:00:00.000Z"),
          visibleUntilUtc: new Date("2026-02-25T19:00:00.000Z"),
          class: { name: "Chemistry", blockNumber: 2 },
        },
      ],
    },
  ];

  return {
    quiz: {
      findMany: async ({ where }) => {
        return quizzes.filter((quiz) => {
          if (quiz.status !== where.status) {
            return false;
          }

          const assignment = quiz.assignments.find(
            (item) => item.classId === where.assignments.some.classId
          );
          if (!assignment) {
            return false;
          }

          return (
            assignment.visibleFromUtc <= where.assignments.some.visibleFromUtc.lte &&
            assignment.visibleUntilUtc > where.assignments.some.visibleUntilUtc.gt &&
            where.attempts.none.studentId === "student_1"
          );
        });
      },
    },
  };
}

describe("student quiz feed service", () => {
  it("returns only currently available quizzes for class", async () => {
    const prisma = createStudentQuizPrismaMock();
    const service = createStudentQuizService({ prisma });

    const result = await service.listAvailableQuizzes({
      classId: "class_1",
      studentId: "student_1",
      now: new Date("2026-02-25T18:00:00.000Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("quiz_open");
  });

  it("requires class id", async () => {
    const prisma = createStudentQuizPrismaMock();
    const service = createStudentQuizService({ prisma });

    await expect(
      service.listAvailableQuizzes({ studentId: "student_1", now: new Date() })
    ).rejects.toBeInstanceOf(StudentQuizServiceError);
  });
});
