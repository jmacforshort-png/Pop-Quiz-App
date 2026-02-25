const { ClassServiceError, createClassService } = require("../src/server/classService");

function createClassPrismaMock() {
  const classes = [];

  function hasDuplicateBlock(adminId, blockNumber, exceptId) {
    return classes.some(
      (item) =>
        item.adminId === adminId &&
        item.blockNumber === blockNumber &&
        (exceptId ? item.id !== exceptId : true)
    );
  }

  return {
    class: {
      findMany: async ({ where }) => {
        return classes
          .filter((item) => item.adminId === where.adminId)
          .sort((a, b) => a.blockNumber - b.blockNumber || a.name.localeCompare(b.name));
      },
      findFirst: async ({ where }) => {
        return (
          classes.find((item) => item.id === where.id && item.adminId === where.adminId) ?? null
        );
      },
      create: async ({ data }) => {
        if (hasDuplicateBlock(data.adminId, data.blockNumber)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }

        const next = {
          id: `class_${classes.length + 1}`,
          ...data,
        };
        classes.push(next);
        return next;
      },
      update: async ({ where, data }) => {
        const existing = classes.find((item) => item.id === where.id);
        if (!existing) {
          throw new Error("Missing class");
        }

        if (hasDuplicateBlock(existing.adminId, data.blockNumber, existing.id)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }

        existing.name = data.name;
        existing.blockNumber = data.blockNumber;
        return existing;
      },
      delete: async ({ where }) => {
        const index = classes.findIndex((item) => item.id === where.id);
        if (index >= 0) {
          classes.splice(index, 1);
        }
      },
    },
  };
}

describe("class service", () => {
  it("creates and lists admin classes", async () => {
    const prisma = createClassPrismaMock();
    const classService = createClassService({ prisma });

    await classService.createClass("admin_1", { name: "Biology", blockNumber: 3 });
    await classService.createClass("admin_1", { name: "Algebra", blockNumber: 1 });

    const result = await classService.listClasses("admin_1");

    expect(result).toHaveLength(2);
    expect(result[0].blockNumber).toBe(1);
  });

  it("rejects duplicate block per admin", async () => {
    const prisma = createClassPrismaMock();
    const classService = createClassService({ prisma });

    await classService.createClass("admin_1", { name: "Chemistry", blockNumber: 2 });

    await expect(
      classService.createClass("admin_1", { name: "Physics", blockNumber: 2 })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Block number already exists"),
    });
  });

  it("allows same block number for a different admin", async () => {
    const prisma = createClassPrismaMock();
    const classService = createClassService({ prisma });

    await classService.createClass("admin_1", { name: "Chemistry", blockNumber: 2 });
    await expect(
      classService.createClass("admin_2", { name: "Physics", blockNumber: 2 })
    ).resolves.toBeTruthy();
  });

  it("updates and deletes only owned classes", async () => {
    const prisma = createClassPrismaMock();
    const classService = createClassService({ prisma });

    const created = await classService.createClass("admin_1", { name: "History", blockNumber: 4 });

    const updated = await classService.updateClass("admin_1", created.id, {
      name: "World History",
      blockNumber: 5,
    });
    expect(updated.name).toBe("World History");

    await classService.deleteClass("admin_1", created.id);

    await expect(classService.deleteClass("admin_1", created.id)).rejects.toBeInstanceOf(
      ClassServiceError
    );
  });
});
