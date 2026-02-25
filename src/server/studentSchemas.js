const { z } = require("zod");

const studentFilterSchema = z.object({
  classId: z.string().optional(),
  blockNumber: z.coerce.number().int().min(1).max(99).optional(),
});

module.exports = {
  studentFilterSchema,
};
