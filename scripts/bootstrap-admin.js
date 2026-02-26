#!/usr/bin/env node

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const prisma = new PrismaClient();

  const username = getArg("username") || process.env.ADMIN_USERNAME;
  const password = getArg("password") || process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error("Usage: npm run admin:bootstrap -- --username <name> --password <password>");
    console.error("Or set ADMIN_USERNAME and ADMIN_PASSWORD environment variables.");
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  if (password.length < 6) {
    console.error("Admin password must be at least 6 characters.");
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  const usernameNormalized = username.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, Number(process.env.AUTH_SALT_ROUNDS || 12));

  const user = await prisma.user.upsert({
    where: { usernameNormalized },
    update: {
      username,
      passwordHash,
      role: "admin",
      classId: null,
      mustChangePassword: false,
    },
    create: {
      username,
      usernameNormalized,
      passwordHash,
      role: "admin",
      classId: null,
      mustChangePassword: false,
    },
  });

  console.log(`Admin ready: ${user.username} (${user.id})`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Failed to bootstrap admin:", error.message);
  process.exit(1);
});
