const AUDIT_ACTIONS = {
  CLASS_CREATED: "CLASS_CREATED",
  CLASS_UPDATED: "CLASS_UPDATED",
  CLASS_DELETED: "CLASS_DELETED",
  STUDENT_PASSWORD_RESET: "STUDENT_PASSWORD_RESET",
  QUIZ_DRAFT_CREATED: "QUIZ_DRAFT_CREATED",
  QUIZ_DRAFT_UPDATED: "QUIZ_DRAFT_UPDATED",
  QUIZ_PUBLISHED: "QUIZ_PUBLISHED",
  QUIZ_RESULTS_PUBLISHED: "QUIZ_RESULTS_PUBLISHED",
};

function createAuditService({ prisma }) {
  if (!prisma) {
    throw new Error("createAuditService requires prisma client.");
  }

  async function logAction({ actorUserId, action, targetType, targetId, quizId }) {
    return prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        quizId,
      },
    });
  }

  async function listLogsForAdmin(actorUserId, limit = 50) {
    return prisma.auditLog.findMany({
      where: { actorUserId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });
  }

  return {
    logAction,
    listLogsForAdmin,
  };
}

module.exports = {
  AUDIT_ACTIONS,
  createAuditService,
};
