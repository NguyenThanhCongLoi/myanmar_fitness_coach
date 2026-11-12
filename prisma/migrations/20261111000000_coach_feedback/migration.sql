-- Additive only: existing rows are untouched.
ALTER TABLE "AiMessage" ADD COLUMN "exerciseId" TEXT;

CREATE TABLE "WorkoutFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "soreMuscles" JSONB NOT NULL DEFAULT '[]',
    "pain" BOOLEAN NOT NULL DEFAULT false,
    "limitation" TEXT NOT NULL DEFAULT '',
    "nextPreference" TEXT NOT NULL DEFAULT 'keep',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkoutFeedback_sessionId_key" ON "WorkoutFeedback"("sessionId");
CREATE INDEX "WorkoutFeedback_userId_createdAt_idx" ON "WorkoutFeedback"("userId", "createdAt");
