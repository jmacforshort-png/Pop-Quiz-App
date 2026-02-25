const { classPayloadSchema } = require("./classSchemas");

class ClassServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function createClassService({ prisma }) {
  if (!prisma) {
    throw new Error("createClassService requires prisma client.");
  }

  async function listClasses(adminId) {
    return prisma.class.findMany({
      where: { adminId },
      orderBy: [{ blockNumber: "asc" }, { name: "asc" }],
    });
  }

  async function createClass(adminId, payload) {
    const parsed = classPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ClassServiceError(400, parsed.error.issues[0]?.message ?? "Invalid class payload.");
    }

    try {
      return await prisma.class.create({
        data: {
          adminId,
          name: parsed.data.name,
          blockNumber: parsed.data.blockNumber,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new ClassServiceError(409, "Block number already exists for this admin.");
      }

      throw new ClassServiceError(500, "Unable to create class.");
    }
  }

  async function updateClass(adminId, classId, payload) {
    const parsed = classPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ClassServiceError(400, parsed.error.issues[0]?.message ?? "Invalid class payload.");
    }

    const existing = await prisma.class.findFirst({ where: { id: classId, adminId } });
    if (!existing) {
      throw new ClassServiceError(404, "Class not found.");
    }

    try {
      return await prisma.class.update({
        where: { id: classId },
        data: {
          name: parsed.data.name,
          blockNumber: parsed.data.blockNumber,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new ClassServiceError(409, "Block number already exists for this admin.");
      }

      throw new ClassServiceError(500, "Unable to update class.");
    }
  }

  async function deleteClass(adminId, classId) {
    const existing = await prisma.class.findFirst({ where: { id: classId, adminId } });
    if (!existing) {
      throw new ClassServiceError(404, "Class not found.");
    }

    await prisma.class.delete({ where: { id: classId } });
  }

  return {
    listClasses,
    createClass,
    updateClass,
    deleteClass,
  };
}

module.exports = {
  ClassServiceError,
  createClassService,
};
