-- Progressive weekly plan (step adapts to completion %), user preferences, per-session completion %.
ALTER TABLE "FitnessProfile" ADD COLUMN "planWeek" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FitnessProfile" ADD COLUMN "planStep" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "FitnessProfile" ADD COLUMN "sessionMinutes" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "FitnessProfile" ADD COLUMN "activityLevel" TEXT NOT NULL DEFAULT 'light';
ALTER TABLE "FitnessProfile" ADD COLUMN "nickname" TEXT NOT NULL DEFAULT '';
ALTER TABLE "WorkoutSession" ADD COLUMN "completionPct" INTEGER;
ALTER TABLE "FitnessProfile" ADD COLUMN "trainTime" TEXT NOT NULL DEFAULT 'evening';
ALTER TABLE "FoodLog" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
