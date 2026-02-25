const crypto = require("node:crypto");
const { hashPassword } = require("./password");
const { resetPasswordSchema, studentFilterSchema } = require("./studentSchemas");

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

  async function resetStudentPassword(adminId, studentId, payload = {}) {
    const parsed = resetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      throw new StudentServiceError(
        400,
        parsed.error.issues[0]?.message ?? "Invalid password payload."
      );
    }

    const student = await prisma.user.findFirst({
      where: {
        id: studentId,
        role: "student",
        class: { adminId },
      },
    });

    if (!student) {
      throw new StudentServiceError(404, "Student not found.");
    }

    const temporaryPassword = parsed.data.newPassword ?? crypto.randomBytes(4).toString("hex");
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { id: studentId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    return {
      temporaryPassword,
      wasGenerated: !parsed.data.newPassword,
    };
  }

  return {
    listStudents,
    resetStudentPassword,
  };
}

module.exports = {
  StudentServiceError,
  createStudentService,
};
