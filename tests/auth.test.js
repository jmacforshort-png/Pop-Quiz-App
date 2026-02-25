const bcrypt = require("bcryptjs");
const { AuthServiceError, createAuthService } = require("../src/server/authService");

function createPrismaMock() {
  const users = [];
  const classes = [
    { id: "class_1", name: "Biology", blockNumber: 1 },
    { id: "class_2", name: "Chemistry", blockNumber: 2 },
  ];

  return {
    user: {
      create: async ({ data }) => {
        if (users.find((user) => user.usernameNormalized === data.usernameNormalized)) {
          const error = new Error("Unique constraint failed.");
          error.code = "P2002";
          throw error;
        }

        const newUser = {
          id: `user_${users.length + 1}`,
          username: data.username,
          usernameNormalized: data.usernameNormalized,
          passwordHash: data.passwordHash,
          role: data.role,
          classId: data.classId ?? null,
        };

        users.push(newUser);
        return newUser;
      },
      findUnique: async ({ where }) => {
        if (where.usernameNormalized) {
          return users.find((user) => user.usernameNormalized === where.usernameNormalized) ?? null;
        }

        return null;
      },
    },
    class: {
      findFirst: async ({ where }) => {
        return classes.find((item) => item.blockNumber === where.blockNumber) ?? null;
      },
    },
    users,
    classes,
  };
}

describe("auth service", () => {
  it("creates account with username and password", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    const result = await authService.signup({
      username: "student_one",
      password: "secret1",
      blockNumber: 1,
    });

    expect(result.user.username).toBe("student_one");
    expect(result.token).toBeTypeOf("string");

    const savedUser = prisma.users[0];
    expect(savedUser.usernameNormalized).toBe("student_one");
    expect(savedUser.classId).toBe("class_1");
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
        blockNumber: 1,
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
      blockNumber: 1,
    });

    await expect(
      authService.signup({
        username: "Student_Three",
        password: "secret2",
        blockNumber: 1,
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
      username: " Student_Four ",
      password: "secret1",
      blockNumber: 1,
    });

    const result = await authService.login({
      username: "student_four",
      password: "secret1",
    });

    expect(result.user.username).toBe("Student_Four");
    expect(result.token).toBeTypeOf("string");
  });

  it("rejects login with invalid credentials", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    await authService.signup({
      username: "student_five",
      password: "secret1",
      blockNumber: 1,
    });

    await expect(
      authService.login({
        username: "student_five",
        password: "wrongpass",
      })
    ).rejects.toBeInstanceOf(AuthServiceError);
  });

  it("rejects signup when block does not exist", async () => {
    const prisma = createPrismaMock();
    const authService = createAuthService({ prisma, jwtSecret: "test-secret" });

    await expect(
      authService.signup({
        username: "student_six",
        password: "secret1",
        blockNumber: 99,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("block number"),
    });
  });
});
