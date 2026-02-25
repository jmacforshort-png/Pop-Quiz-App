const { SESSION_COOKIE, verifySessionToken } = require("./session");

function requireAuth(jwtSecret) {
  if (!jwtSecret) {
    throw new Error("requireAuth middleware requires jwtSecret.");
  }

  return (req, res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      req.auth = verifySessionToken(token, jwtSecret);
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid session." });
    }
  };
}

function requireRole(allowedRoles) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.auth || !allowed.includes(req.auth.role)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
