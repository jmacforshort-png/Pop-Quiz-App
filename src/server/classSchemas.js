const { z } = require("zod");

const classPayloadSchema = z.object({
  name: z.string().trim().min(1, "Class name is required.").max(120, "Class name is too long."),
  blockNumber: z
    .number({ invalid_type_error: "Block number must be a number." })
    .int("Block number must be an integer.")
    .min(1, "Block number must be at least 1.")
    .max(99, "Block number must be less than 100."),
});

module.exports = {
  classPayloadSchema,
};
