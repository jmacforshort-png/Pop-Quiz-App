ALTER TABLE "User"
ADD COLUMN "usernameNormalized" TEXT;

UPDATE "User"
SET "usernameNormalized" = LOWER(TRIM("username"));

ALTER TABLE "User"
ALTER COLUMN "usernameNormalized" SET NOT NULL;

CREATE UNIQUE INDEX "User_usernameNormalized_key" ON "User"("usernameNormalized");
