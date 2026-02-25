const bcrypt = require("bcryptjs");

const DEFAULT_SALT_ROUNDS = 12;

function resolveSaltRounds() {
  const configured = Number(process.env.AUTH_SALT_ROUNDS || DEFAULT_SALT_ROUNDS);
  if (!Number.isInteger(configured) || configured < 10) {
    return DEFAULT_SALT_ROUNDS;
  }

  return configured;
}

async function hashPassword(password) {
  return bcrypt.hash(password, resolveSaltRounds());
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  DEFAULT_SALT_ROUNDS,
  hashPassword,
  verifyPassword,
  resolveSaltRounds,
};
