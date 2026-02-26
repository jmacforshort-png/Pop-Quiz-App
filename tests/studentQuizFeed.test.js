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
      attempts: [],
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
      attempts: [],
    },
    {
      id: "quiz_upcoming",
      title: "Upcoming Quiz",
      description: "Opens later",
      status: "published",
      publishedAt: new Date("2026-02-25T20:00:00.000Z"),
      assignments: [
        {
          classId: "class_1",
          visibleFromUtc: new Date("2026-02-25T19:00:00.000Z"),
          visibleUntilUtc: new Date("2026-02-25T21:00:00.000Z"),
          class: { name: "Biology", blockNumber: 1 },
        },
      ],
      attempts: [],
    },
    {
      id: "quiz_submitted",
      title: "Submitted Quiz",
      description: "Already taken",
      status: "published",
      publishedAt: new Date("2026-02-25T14:00:00.000Z"),
      assignments: [
        {
          classId: "class_1",
          visibleFromUtc: new Date("2026-02-25T13:00:00.000Z"),
          visibleUntilUtc: new Date("2026-02-25T19:00:00.000Z"),
          class: { name: "Biology", blockNumber: 1 },
        },
      ],
      attempts: [{ id: "attempt_1", studentId: "student_1" }],
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
      attempts: [],
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

          if (where.assignments.some.visibleFromUtc && where.assignments.some.visibleUntilUtc) {
            return (
              assignment.visibleFromUtc <= where.assignments.some.visibleFromUtc.lte &&
              assignment.visibleUntilUtc > where.assignments.some.visibleUntilUtc.gt &&
              where.attempts.none.studentId === "student_1" &&
              !quiz.attempts?.some((attempt) => attempt.studentId === where.attempts.none.studentId)
            );
          }

          return (
            where.assignments.some.classId === "class_1" &&
            (!where.attempts?.none ||
              !quiz.attempts?.some(
                (attempt) => attempt.studentId === where.attempts.none.studentId
              ))
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

  it("returns availability statuses for student dashboard feed", async () => {
    const prisma = createStudentQuizPrismaMock();
    const service = createStudentQuizService({ prisma });

    const feed = await service.listQuizFeed({
      classId: "class_1",
      studentId: "student_1",
      now: new Date("2026-02-25T18:00:00.000Z"),
    });

    const statusByQuiz = new Map(feed.map((item) => [item.id, item.availabilityStatus]));
    expect(statusByQuiz.get("quiz_open")).toBe("available");
    expect(statusByQuiz.get("quiz_closed")).toBe("closed");
    expect(statusByQuiz.get("quiz_upcoming")).toBe("upcoming");
    expect(statusByQuiz.get("quiz_submitted")).toBe("submitted");
  });
});
