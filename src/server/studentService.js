const { studentFilterSchema } = require("./studentSchemas");

class StudentServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function createStudentService({ prisma }) {
  if (!prisma) {
    throw new Error("createStudentService requires prisma client.");
  }

  async function listStudents(adminId, filters = {}) {
    const parsed = studentFilterSchema.safeParse(filters);
    if (!parsed.success) {
      throw new StudentServiceError(400, "Invalid student directory filters.");
    }

    const where = {
      role: "student",
      class: {
        adminId,
      },
    };

    if (parsed.data.classId) {
      where.classId = parsed.data.classId;
    }

    if (parsed.data.blockNumber) {
      where.class.blockNumber = parsed.data.blockNumber;
    }

    return prisma.user.findMany({
      where,
      orderBy: [{ class: { blockNumber: "asc" } }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        mustChangePassword: true,
        createdAt: true,
        classId: true,
        class: {
          select: {
            id: true,
            name: true,
            blockNumber: true,
          },
        },
      },
    });
  }

  return {
    listStudents,
  };
}

module.exports = {
  StudentServiceError,
  createStudentService,
};
