-- CreateTable
CREATE TABLE "GameState" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Yangon',
    "weekdays" JSONB NOT NULL,
    "weeklyGoal" INTEGER NOT NULL DEFAULT 3,
    "protectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shields" INTEGER NOT NULL DEFAULT 2,
    "recoveryUntil" TEXT,
    "pendingTimezone" TEXT,
    "timezoneEffectiveAt" DATETIME,
    "lastTimezoneChange" DATETIME,
    "cursor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "planned" BOOLEAN NOT NULL,
    "weeklyGoal" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'open',
    CONSTRAINT "GameDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkoutCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkoutCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "milestones" BOOLEAN NOT NULL DEFAULT true,
    "summaries" BOOLEAN NOT NULL DEFAULT true,
    "restMessages" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinute" INTEGER NOT NULL DEFAULT 1080,
    "quietStart" INTEGER NOT NULL DEFAULT 1260,
    "quietEnd" INTEGER NOT NULL DEFAULT 480,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" DATETIME,
    "readAt" DATETIME,
    "pushState" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "NotificationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "subscription" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'claimed',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PushDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "NotificationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PushDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkoutSession_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "PlanDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutSession" ("dayId", "endedAt", "id", "note", "planId", "startedAt", "status", "userId") SELECT "dayId", "endedAt", "id", "note", "planId", "startedAt", "status", "userId" FROM "WorkoutSession";
DROP TABLE "WorkoutSession";
ALTER TABLE "new_WorkoutSession" RENAME TO "WorkoutSession";
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GameDay_userId_week_idx" ON "GameDay"("userId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "GameDay_userId_day_key" ON "GameDay"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCredit_sessionId_key" ON "WorkoutCredit"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCredit_userId_day_key" ON "WorkoutCredit"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_userId_key_key" ON "Achievement"("userId", "key");

-- CreateIndex
CREATE INDEX "NotificationJob_userId_status_idx" ON "NotificationJob"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_userId_key_key" ON "NotificationJob"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_endpoint_key" ON "PushDevice"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "PushDelivery_jobId_deviceId_key" ON "PushDelivery"("jobId", "deviceId");

