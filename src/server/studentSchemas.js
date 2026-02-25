const { z } = require("zod");

const studentFilterSchema = z.object({
  classId: z.string().optional(),
  blockNumber: z.coerce.number().int().min(1).max(99).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters long.").optional(),
});

module.exports = {
  studentFilterSchema,
  resetPasswordSchema,
};
