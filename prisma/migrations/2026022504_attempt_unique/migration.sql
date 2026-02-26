-- Ensure each student can submit only one attempt per quiz
CREATE UNIQUE INDEX "Attempt_quizId_studentId_key" ON "Attempt"("quizId", "studentId");
