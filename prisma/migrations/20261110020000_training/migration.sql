-- CreateTable
CREATE TABLE "FavoriteExercise" (
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "exerciseId"),
    CONSTRAINT "FavoriteExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FavoriteExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "originalExerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "targetKg" REAL NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutPhaseLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "phaseIndex" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "exerciseId" TEXT,
    "seconds" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutPhaseLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    CONSTRAINT "WorkoutAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "muscles" JSONB NOT NULL,
    "equipment" JSONB NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'standard',
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "dataLicense" TEXT NOT NULL,
    "attribution" TEXT NOT NULL,
    "mediaStatus" TEXT NOT NULL DEFAULT 'not_imported',
    "canonicalId" TEXT,
    "primaryMuscles" JSONB NOT NULL DEFAULT '[]',
    "secondaryMuscles" JSONB NOT NULL DEFAULT '[]',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "tracking" TEXT NOT NULL DEFAULT 'reps',
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'none',
    "mediaSource" TEXT NOT NULL DEFAULT '',
    "mediaLicenseStatus" TEXT NOT NULL DEFAULT 'unavailable',
    "commonMistakes" JSONB NOT NULL DEFAULT '[]',
    "alternatives" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Exercise" ("attribution", "createdAt", "dataLicense", "difficulty", "equipment", "id", "instructions", "mediaStatus", "muscles", "name", "normalizedName", "source", "sourceId", "sourceUrl") SELECT "attribution", "createdAt", "dataLicense", "difficulty", "equipment", "id", "instructions", "mediaStatus", "muscles", "name", "normalizedName", "source", "sourceId", "sourceUrl" FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
CREATE UNIQUE INDEX "Exercise_normalizedName_key" ON "Exercise"("normalizedName");
CREATE UNIQUE INDEX "Exercise_canonicalId_key" ON "Exercise"("canonicalId");
CREATE UNIQUE INDEX "Exercise_source_sourceId_key" ON "Exercise"("source", "sourceId");
CREATE TABLE "new_WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "note" TEXT NOT NULL DEFAULT '',
    "creditTimezone" TEXT NOT NULL DEFAULT 'Asia/Yangon',
    "mode" TEXT NOT NULL DEFAULT 'free',
    "pausedAt" DATETIME,
    "totalPausedMs" INTEGER NOT NULL DEFAULT 0,
    "restUntil" DATETIME,
    "restRemainingMs" INTEGER NOT NULL DEFAULT 0,
    "creditTargetSets" INTEGER NOT NULL DEFAULT 0,
    "playerPlan" JSONB,
    "playerIndex" INTEGER NOT NULL DEFAULT 0,
    "phaseElapsedMs" INTEGER NOT NULL DEFAULT 0,
    "phaseStartedAt" DATETIME,
    "revision" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSession_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "PlanDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutSession" ("creditTimezone", "dayId", "endedAt", "id", "note", "planId", "startedAt", "status", "userId") SELECT "creditTimezone", "dayId", "endedAt", "id", "note", "planId", "startedAt", "status", "userId" FROM "WorkoutSession";
DROP TABLE "WorkoutSession";
ALTER TABLE "new_WorkoutSession" RENAME TO "WorkoutSession";
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");
CREATE TABLE "new_WorkoutSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "weightKg" REAL NOT NULL,
    "restSeconds" INTEGER NOT NULL DEFAULT 60,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "loggedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutSet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutSet" ("completed", "exerciseId", "id", "loggedAt", "reps", "restSeconds", "sessionId", "setIndex", "weightKg") SELECT "completed", "exerciseId", "id", "loggedAt", "reps", "restSeconds", "sessionId", "setIndex", "weightKg" FROM "WorkoutSet";
DROP TABLE "WorkoutSet";
ALTER TABLE "new_WorkoutSet" RENAME TO "WorkoutSet";
CREATE UNIQUE INDEX "WorkoutSet_sessionId_exerciseId_setIndex_key" ON "WorkoutSet"("sessionId", "exerciseId", "setIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SessionExercise_sessionId_exerciseId_key" ON "SessionExercise"("sessionId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPhaseLog_sessionId_phaseIndex_key" ON "WorkoutPhaseLog"("sessionId", "phaseIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutAction_sessionId_actionId_key" ON "WorkoutAction"("sessionId", "actionId");

