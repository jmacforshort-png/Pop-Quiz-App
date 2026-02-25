const { loginSchema, signupSchema } = require("./authSchemas");
const { hashPassword, verifyPassword } = require("./password");
const { issueSessionToken } = require("./session");
const { normalizeUsername } = require("./username");

class AuthServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    classId: user.classId,
  };
}

function createAuthService({ prisma, jwtSecret }) {
  if (!prisma) {
    throw new Error("createAuthService requires prisma client.");
  }

  if (!jwtSecret) {
    throw new Error("createAuthService requires jwtSecret.");
  }

  async function signup(payload) {
    const parsed = signupSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AuthServiceError(400, parsed.error.issues[0]?.message ?? "Invalid signup payload.");
    }

    const { username, password, classId } = parsed.data;
    const usernameNormalized = normalizeUsername(username);

    try {
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          username,
          usernameNormalized,
          passwordHash,
          role: "student",
          classId,
        },
      });

      return {
        user: publicUser(user),
        token: issueSessionToken(user, jwtSecret),
      };
    } catch (error) {
      if (error?.code === "P2002") {
        throw new AuthServiceError(409, "Username already taken. Choose a different username.");
      }

      throw new AuthServiceError(500, "Unable to create account.");
    }
  }

  async function login(payload) {
    const parsed = loginSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AuthServiceError(400, parsed.error.issues[0]?.message ?? "Invalid login payload.");
    }

    const { username, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { usernameNormalized: normalizeUsername(username) },
    });

    if (!user) {
      throw new AuthServiceError(401, "Invalid username or password.");
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      throw new AuthServiceError(401, "Invalid username or password.");
    }

    return {
      user: publicUser(user),
      token: issueSessionToken(user, jwtSecret),
    };
  }

  return {
    signup,
    login,
  };
}

module.exports = {
  AuthServiceError,
  createAuthService,
};
