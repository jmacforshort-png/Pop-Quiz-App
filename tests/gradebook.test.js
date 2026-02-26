const { createQuizService } = require("../src/server/quizService");

function createPrismaMock() {
  const classes = [
    { id: "class_1", adminId: "admin_1", name: "Biology", blockNumber: 1 },
    { id: "class_2", adminId: "admin_1", name: "Chemistry", blockNumber: 2 },
  ];

  return {
    class: {
      findFirst: async ({ where }) =>
        classes.find((item) => item.id === where.id && item.adminId === where.adminId) ?? null,
    },
    quiz: {
      findFirst: async ({ where }) => {
        if (where.id === "quiz_1" && where.adminId === "admin_1") {
          return { id: "quiz_1" };
        }
        return null;
      },
      findMany: async ({ where }) => {
        if (where.id && where.id !== "quiz_1") {
          return [];
        }

        return [
          {
            id: "quiz_1",
            title: "Unit 1 Quiz",
            assignments: [
              {
                classId: "class_1",
                visibleUntilUtc: new Date("2026-02-25T19:00:00.000Z"),
                class: {
                  id: "class_1",
                  name: "Biology",
                  blockNumber: 1,
                  students: [
                    { id: "student_1", username: "amy" },
                    { id: "student_2", username: "brad" },
                  ],
                },
              },
            ],
            attempts: [
              {
                studentId: "student_1",
                score: 4,
                maxScore: 5,
                submittedAt: new Date("2026-02-25T18:30:00.000Z"),
              },
            ],
          },
        ];
      },
    },
  };
}

describe("gradebook report", () => {
  it("returns submitted and missing rows in one table", async () => {
    const service = createQuizService({ prisma: createPrismaMock() });
    const rows = await service.getGradebookReport("admin_1", {
      classId: "class_1",
      quizId: "quiz_1",
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveProperty("status");
    expect(rows.some((row) => row.status === "submitted")).toBe(true);
    expect(rows.some((row) => row.status === "missing")).toBe(true);
  });

  it("marks late submissions", async () => {
    const prisma = createPrismaMock();
    prisma.quiz.findMany = async () => [
      {
        id: "quiz_1",
        title: "Unit 1 Quiz",
        assignments: [
          {
            classId: "class_1",
            visibleUntilUtc: new Date("2026-02-25T18:00:00.000Z"),
            class: {
              id: "class_1",
              name: "Biology",
              blockNumber: 1,
              students: [{ id: "student_1", username: "amy" }],
            },
          },
        ],
        attempts: [
          {
            studentId: "student_1",
            score: 5,
            maxScore: 5,
            submittedAt: new Date("2026-02-25T18:05:00.000Z"),
          },
        ],
      },
    ];

    const service = createQuizService({ prisma });
    const rows = await service.getGradebookReport("admin_1", {
      classId: "class_1",
      quizId: "quiz_1",
    });

    expect(rows[0].late).toBe(true);
  });
});
