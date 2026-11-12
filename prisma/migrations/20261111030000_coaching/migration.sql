-- Additive: reps in reserve per set (optional).
ALTER TABLE "WorkoutSet" ADD COLUMN "rir" INTEGER;
CREATE TABLE "ReadinessCheck" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "day" TEXT NOT NULL, "sleep" INTEGER NOT NULL, "energy" INTEGER NOT NULL, "soreness" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadinessCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReadinessCheck_userId_day_key" ON "ReadinessCheck"("userId", "day");
ALTER TABLE "FitnessProfile" ADD COLUMN "screening" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "BodyMeasurement" ADD COLUMN "waistCm" REAL;
