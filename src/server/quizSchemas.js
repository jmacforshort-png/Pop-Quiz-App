const { z } = require("zod");

const baseQuizSchema = z.object({
  title: z.string().trim().min(1, "Quiz title is required.").max(160, "Quiz title is too long."),
  description: z.string().trim().max(2000, "Quiz description is too long.").optional(),
  assignments: z
    .array(
      z.object({
        classId: z.string().min(1, "Class assignment requires classId."),
        visibleFromUtc: z.string().datetime("Visible from is required."),
        visibleUntilUtc: z.string().datetime("Visible until is required."),
      })
    )
    .min(1, "Select at least one block for this quiz."),
  questions: z.array(z.any()),
});

module.exports = {
  baseQuizSchema,
};
