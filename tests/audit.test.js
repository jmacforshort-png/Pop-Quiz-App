const { AUDIT_ACTIONS, createAuditService } = require("../src/server/auditService");

function createAuditPrismaMock() {
  const logs = [];

  return {
    auditLog: {
      create: async ({ data }) => {
        const entry = {
          id: `log_${logs.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        logs.push(entry);
        return entry;
      },
      findMany: async ({ where, take }) => {
        return logs.filter((log) => log.actorUserId === where.actorUserId).slice(0, take ?? 50);
      },
    },
    logs,
  };
}

describe("audit service", () => {
  it("records audit events", async () => {
    const prisma = createAuditPrismaMock();
    const auditService = createAuditService({ prisma });

    await auditService.logAction({
      actorUserId: "admin_1",
      action: AUDIT_ACTIONS.CLASS_CREATED,
      targetType: "class",
      targetId: "class_1",
    });

    expect(prisma.logs).toHaveLength(1);
    expect(prisma.logs[0].action).toBe("CLASS_CREATED");
  });

  it("returns logs for a specific admin", async () => {
    const prisma = createAuditPrismaMock();
    const auditService = createAuditService({ prisma });

    await auditService.logAction({
      actorUserId: "admin_1",
      action: AUDIT_ACTIONS.CLASS_CREATED,
      targetType: "class",
      targetId: "class_1",
    });
    await auditService.logAction({
      actorUserId: "admin_2",
      action: AUDIT_ACTIONS.CLASS_UPDATED,
      targetType: "class",
      targetId: "class_2",
    });

    const result = await auditService.listLogsForAdmin("admin_1", 50);

    expect(result).toHaveLength(1);
    expect(result[0].actorUserId).toBe("admin_1");
  });
});
