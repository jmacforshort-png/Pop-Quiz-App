const { ClassServiceError, createClassService } = require("../src/server/classService");
const { QuizServiceError, createQuizService } = require("../src/server/quizService");
const {
  StudentQuizServiceError,
  createStudentQuizService,
} = require("../src/server/studentQuizService");

describe("authorization boundaries", () => {
  it("blocks class update/delete outside admin ownership", async () => {
    const prisma = {
      class: {
        findFirst: async ({ where }) =>
          where.id === "class_1" && where.adminId === "admin_1"
            ? { id: "class_1", adminId: "admin_1", name: "Biology", blockNumber: 1 }
            : null,
        update: async () => ({}),
        delete: async () => ({}),
      },
    };
    const service = createClassService({ prisma });

    await expect(
      service.updateClass("admin_2", "class_1", { name: "Changed", blockNumber: 2 })
    ).rejects.toBeInstanceOf(ClassServiceError);
    await expect(service.deleteClass("admin_2", "class_1")).rejects.toBeInstanceOf(
      ClassServiceError
    );
  });

  it("blocks quiz read/update/publish outside admin ownership", async () => {
    const prisma = {
      class: { findMany: async () => [] },
      quiz: {
        findFirst: async ({ where }) =>
          where.id === "quiz_1" && where.adminId === "admin_1"
            ? {
                id: "quiz_1",
                adminId: "admin_1",
                title: "Quiz",
                status: "draft",
                resultStatus: "hidden",
                assignments: [],
                questions: [],
              }
            : null,
        update: async () => ({}),
      },
    };
    const service = createQuizService({ prisma });

    await expect(service.getQuizById("admin_2", "quiz_1")).rejects.toBeInstanceOf(QuizServiceError);
    await expect(
      service.updateDraftQuiz("admin_2", "quiz_1", {
        title: "Q",
        assignments: [],
        questions: [],
      })
    ).rejects.toBeInstanceOf(QuizServiceError);
    await expect(service.publishQuiz("admin_2", "quiz_1")).rejects.toBeInstanceOf(QuizServiceError);
  });

  it("blocks student quiz payload outside assigned class window", async () => {
    const prisma = {
      attempt: {
        findFirst: async () => null,
      },
      quiz: {
        findFirst: async () => null,
      },
    };
    const service = createStudentQuizService({ prisma });

    await expect(
      service.getQuizForStudent({
        classId: "class_1",
        quizId: "quiz_1",
        studentId: "student_1",
        now: new Date("2026-02-25T18:00:00.000Z"),
      })
    ).rejects.toBeInstanceOf(StudentQuizServiceError);
  });
});
