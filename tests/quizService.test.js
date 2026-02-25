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
    { id: "class_1", adminId: "admin_1", name: "Biology", blockNumber: 1 },
    { id: "class_2", adminId: "admin_1", name: "Chemistry", blockNumber: 2 },
    { id: "class_3", adminId: "admin_2", name: "Physics", blockNumber: 1 },
  ];

  const quizzes = [];

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
        const quiz = {
          id: `quiz_${quizzes.length + 1}`,
          adminId: data.adminId,
          title: data.title,
          description: data.description,
          status: data.status,
          resultStatus: "hidden",
          createdAt: new Date(),
          publishedAt: null,
          resultsPublishedAt: null,
          assignments: data.assignments.create.map((assignment) => ({
            classId: assignment.classId,
            visibleFromUtc: assignment.visibleFromUtc,
            visibleUntilUtc: assignment.visibleUntilUtc,
            class: classes.find((classItem) => classItem.id === assignment.classId),
          })),
          questions: data.questions.create.map((question) => ({
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            choices: question.choices.create,
          })),
        };
        quizzes.push(quiz);
        return quiz;
      },
      findMany: async ({ where }) => {
        return quizzes.filter((quiz) => quiz.adminId === where.adminId);
      },
      findFirst: async ({ where }) => {
        return (
          quizzes.find((quiz) => {
            if (where.id && quiz.id !== where.id) {
              return false;
            }
            if (where.adminId && quiz.adminId !== where.adminId) {
              return false;
            }
            return true;
          }) ?? null
        );
      },
      update: async ({ where, data }) => {
        const quiz = quizzes.find((item) => item.id === where.id);
        if (data.title !== undefined) {
          quiz.title = data.title;
        }
        if (data.description !== undefined) {
          quiz.description = data.description;
        }
        if (data.assignments?.create) {
          quiz.assignments = data.assignments.create.map((assignment) => ({
            classId: assignment.classId,
            visibleFromUtc: assignment.visibleFromUtc,
            visibleUntilUtc: assignment.visibleUntilUtc,
            class: classes.find((classItem) => classItem.id === assignment.classId),
          }));
        }
        if (data.questions?.create) {
          quiz.questions = data.questions.create.map((question) => ({
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            choices: question.choices.create,
          }));
        }
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

  it("lists and gets quizzes by admin ownership", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });

    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());

    const list = await quizService.listQuizzes("admin_1");
    expect(list).toHaveLength(1);

    const loaded = await quizService.getQuizById("admin_1", created.id);
    expect(loaded.id).toBe(created.id);
  });

  it("updates existing draft quiz", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });

    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());
    const payload = validQuizPayload();
    payload.title = "Updated Quiz";

    const updated = await quizService.updateDraftQuiz("admin_1", created.id, payload);

    expect(updated.title).toBe("Updated Quiz");
    expect(updated.questions).toHaveLength(5);
  });

  it("publishes a draft quiz", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());

    const published = await quizService.publishQuiz("admin_1", created.id);

    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects publishing non-draft quizzes", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());
    await quizService.publishQuiz("admin_1", created.id);

    await expect(quizService.publishQuiz("admin_1", created.id)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("publishes results for published quizzes", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());
    await quizService.publishQuiz("admin_1", created.id);

    const resultPublished = await quizService.publishResults("admin_1", created.id);

    expect(resultPublished.resultStatus).toBe("published");
    expect(resultPublished.resultsPublishedAt).toBeInstanceOf(Date);
  });

  it("rejects publishing results for draft quizzes", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());

    await expect(quizService.publishResults("admin_1", created.id)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects publishing results twice", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const created = await quizService.createDraftQuiz("admin_1", validQuizPayload());
    await quizService.publishQuiz("admin_1", created.id);
    await quizService.publishResults("admin_1", created.id);

    await expect(quizService.publishResults("admin_1", created.id)).rejects.toMatchObject({
      statusCode: 400,
    });
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

  it("rejects assignment timestamps without timezone offset", async () => {
    const prisma = createQuizPrismaMock();
    const quizService = createQuizService({ prisma });
    const payload = validQuizPayload();
    payload.assignments[0].visibleFromUtc = "2026-02-25T18:00:00";

    await expect(quizService.createDraftQuiz("admin_1", payload)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("returns quiz summary report with assigned/submitted/average", async () => {
    const prisma = {
      quiz: {
        findMany: async () => [
          {
            id: "quiz_1",
            title: "Unit 1 Quiz",
            status: "published",
            resultStatus: "hidden",
            assignments: [
              {
                class: {
                  id: "class_1",
                  name: "Biology",
                  blockNumber: 1,
                  students: [{ id: "student_1" }, { id: "student_2" }],
                },
              },
            ],
            attempts: [
              { score: 4, student: { id: "student_1", classId: "class_1" } },
              { score: 2, student: { id: "student_2", classId: "class_1" } },
            ],
          },
        ],
      },
    };

    const quizService = createQuizService({ prisma });
    const report = await quizService.getQuizSummaryReport("admin_1");

    expect(report).toHaveLength(1);
    expect(report[0].assignedCount).toBe(2);
    expect(report[0].submittedCount).toBe(2);
    expect(report[0].averageScore).toBe(3);
  });

  it("filters quiz summary report by block", async () => {
    const prisma = {
      quiz: {
        findMany: async () => [
          {
            id: "quiz_2",
            title: "Unit 2 Quiz",
            status: "published",
            resultStatus: "published",
            assignments: [
              {
                class: {
                  id: "class_2",
                  name: "Chemistry",
                  blockNumber: 2,
                  students: [{ id: "student_3" }],
                },
              },
            ],
            attempts: [{ score: 5, student: { id: "student_3", classId: "class_2" } }],
          },
        ],
      },
    };

    const quizService = createQuizService({ prisma });
    const report = await quizService.getQuizSummaryReport("admin_1", { blockNumber: 2 });

    expect(report).toHaveLength(1);
    expect(report[0].blockNumbers).toEqual([2]);
    expect(report[0].assignedCount).toBe(1);
  });
});
