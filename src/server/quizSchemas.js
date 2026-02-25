const { z } = require("zod");

const baseQuizSchema = z.object({
  title: z.string().trim().min(1, "Quiz title is required.").max(160, "Quiz title is too long."),
  description: z.string().trim().max(2000, "Quiz description is too long.").optional(),
  questions: z.array(z.any()),
});

module.exports = {
  baseQuizSchema,
};
