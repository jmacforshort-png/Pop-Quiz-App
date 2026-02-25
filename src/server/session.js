const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "pop_quiz_session";
const SESSION_TTL = "7d";

function issueSessionToken(user, jwtSecret) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      classId: user.classId ?? null,
    },
    jwtSecret,
    { expiresIn: SESSION_TTL }
  );
}

function verifySessionToken(token, jwtSecret) {
  return jwt.verify(token, jwtSecret);
}

function attachSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL,
  issueSessionToken,
  verifySessionToken,
  attachSessionCookie,
  clearSessionCookie,
};
