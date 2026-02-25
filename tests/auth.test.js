const bcrypt = require("bcryptjs");
const { AuthServiceError, createAuthService } = require("../src/server/authService");

function createPrismaMock() {
  const users = [];

  return {
    user: {
      create: async ({ data }) => {
        if (users.find((user) => user.username === data.username)) {
          const error = new Error("Unique constraint failed.");
          error.code = "P2002";
          throw error;
        }

        const newUser = {
          id: `user_${users.length + 1}`,
          username: data.username,
          passwordHash: data.passwordHash,
          role: data.role,
          classId: data.classId ?? null,
        };

        users.push(newUser);
        return newUser;
      },
      findUnique: async ({ where }) => {
        return users.find((user) => user.username === where.username) ?? null;
      },
    },
    users,
  };
}

describe("auth service", () => {
  it("creates account with username and password", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    const result = await authService.signup({
      username: "student_one",
      password: "secret1",
      classId: "class_1",
    });

    expect(result.user.username).toBe("student_one");
    expect(result.token).toBeTypeOf("string");

    const savedUser = prisma.users[0];
    expect(savedUser.passwordHash).not.toBe("secret1");
    expect(await bcrypt.compare("secret1", savedUser.passwordHash)).toBe(true);
  });

  it("rejects short passwords", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    await expect(
      authService.signup({
        username: "student_two",
        password: "123",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("at least 6 characters"),
    });
  });

  it("prevents duplicate usernames", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    await authService.signup({
      username: "student_three",
      password: "secret1",
    });

    await expect(
      authService.signup({
        username: "student_three",
        password: "secret2",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("Username already taken"),
    });
  });

  it("logs in users with valid credentials", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    await authService.signup({
      username: "student_four",
      password: "secret1",
    });

    const result = await authService.login({
      username: "student_four",
      password: "secret1",
    });

    expect(result.user.username).toBe("student_four");
    expect(result.token).toBeTypeOf("string");
  });

  it("rejects login with invalid credentials", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    await authService.signup({
      username: "student_five",
      password: "secret1",
    });

    await expect(
      authService.login({
        username: "student_five",
        password: "wrongpass",
      })
    ).rejects.toBeInstanceOf(AuthServiceError);
  });
});
