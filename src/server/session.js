const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "pop_quiz_session";

function issueSessionToken(user, jwtSecret) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: "7d" }
  );
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
  issueSessionToken,
  attachSessionCookie,
  clearSessionCookie,
};
