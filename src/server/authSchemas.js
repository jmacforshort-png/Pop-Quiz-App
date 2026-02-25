const { z } = require("zod");

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long.")
    .max(30, "Username cannot exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only include letters, numbers, and underscores."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  blockNumber: z
    .number({ invalid_type_error: "Block number is required." })
    .int("Block number must be an integer.")
    .min(1, "Block number must be at least 1.")
    .max(99, "Block number must be less than 100."),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

module.exports = {
  signupSchema,
  loginSchema,
};
