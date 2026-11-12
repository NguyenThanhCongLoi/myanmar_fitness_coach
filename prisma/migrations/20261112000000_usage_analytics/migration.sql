-- First-party usage analytics + per-user opt-out.
ALTER TABLE "FitnessProfile" ADD COLUMN "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "screen" TEXT,
    "device" TEXT,
    "locale" TEXT,
    "props" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");
CREATE INDEX "UsageEvent_name_createdAt_idx" ON "UsageEvent"("name", "createdAt");
