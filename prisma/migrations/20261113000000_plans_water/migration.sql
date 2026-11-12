-- Day-by-day programmes, water tracker.
ALTER TABLE "FitnessProfile" ADD COLUMN "program" TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE "WorkoutSession" ADD COLUMN "programKey" TEXT;
ALTER TABLE "WorkoutSession" ADD COLUMN "programDay" INTEGER;
ALTER TABLE "SessionExercise" ADD COLUMN "timed" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "WaterLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "ml" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WaterLog_userId_day_idx" ON "WaterLog"("userId", "day");
