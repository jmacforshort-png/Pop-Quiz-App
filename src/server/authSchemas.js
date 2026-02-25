const { z } = require("zod");

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long.")
    .max(30, "Username cannot exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only include letters, numbers, and underscores."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  classId: z.string().optional(),
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

module.exports = {
  signupSchema,
  loginSchema,
};
