CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_createdAt_idx"
ON "AuditLog"("actorUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx"
ON "AuditLog"("targetType", "targetId");
