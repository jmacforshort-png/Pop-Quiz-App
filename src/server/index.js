const { createAuthApp } = require("./app");
const { prisma } = require("./prismaClient");

const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.AUTH_JWT_SECRET;

if (!jwtSecret) {
  throw new Error("AUTH_JWT_SECRET is required to start the auth server.");
}

const app = createAuthApp({ prisma, jwtSecret });

app.listen(port, () => {
  console.log(`Auth API listening on http://localhost:${port}`);
});
