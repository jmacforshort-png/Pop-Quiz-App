-- AddColumn
ALTER TABLE "Attempt" ADD COLUMN "startedAt" TIMESTAMP(3);

-- AddColumn
ALTER TABLE "Attempt" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;

-- Backfill startedAt for existing attempts
UPDATE "Attempt"
SET "startedAt" = "submittedAt"
WHERE "startedAt" IS NULL;

-- Backfill late flag from class assignment windows
UPDATE "Attempt" AS a
SET "late" = EXISTS (
  SELECT 1
  FROM "User" AS u
  JOIN "QuizClassAssignment" AS qca
    ON qca."classId" = u."classId"
  WHERE u."id" = a."studentId"
    AND qca."quizId" = a."quizId"
    AND a."submittedAt" > qca."visibleUntilUtc"
);

-- CreateIndex
CREATE INDEX "Quiz_adminId_status_createdAt_idx" ON "Quiz"("adminId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "QuizClassAssignment_classId_visibleFromUtc_visibleUntilUtc_idx" ON "QuizClassAssignment"("classId", "visibleFromUtc", "visibleUntilUtc");

-- CreateIndex
CREATE INDEX "QuizClassAssignment_quizId_visibleFromUtc_idx" ON "QuizClassAssignment"("quizId", "visibleFromUtc");

-- CreateIndex
CREATE INDEX "Attempt_quizId_submittedAt_idx" ON "Attempt"("quizId", "submittedAt");

-- CreateIndex
CREATE INDEX "Attempt_studentId_submittedAt_idx" ON "Attempt"("studentId", "submittedAt");

-- CreateIndex
CREATE INDEX "Attempt_late_idx" ON "Attempt"("late");
