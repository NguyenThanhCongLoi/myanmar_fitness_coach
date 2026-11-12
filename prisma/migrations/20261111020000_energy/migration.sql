-- Additive: optional body metrics and self-reported energy logs.
ALTER TABLE "FitnessProfile" ADD COLUMN "heightCm" REAL;
ALTER TABLE "FitnessProfile" ADD COLUMN "birthYear" INTEGER;
ALTER TABLE "FitnessProfile" ADD COLUMN "sex" TEXT;
ALTER TABLE "FitnessProfile" ADD COLUMN "goalWeightKg" REAL;
ALTER TABLE "FitnessProfile" ADD COLUMN "weightGoal" TEXT NOT NULL DEFAULT 'maintain';
CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "day" TEXT NOT NULL, "meal" TEXT NOT NULL, "description" TEXT NOT NULL,
    "kcal" INTEGER NOT NULL, "proteinG" REAL NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FoodLog_userId_day_idx" ON "FoodLog"("userId", "day");
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "day" TEXT NOT NULL, "kind" TEXT NOT NULL, "minutes" INTEGER NOT NULL,
    "kcal" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ActivityLog_userId_day_idx" ON "ActivityLog"("userId", "day");
