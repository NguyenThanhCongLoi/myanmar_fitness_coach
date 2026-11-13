ALTER TABLE "FitnessProfile" ADD COLUMN "intakeVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FitnessProfile" ADD COLUMN "trainingLocation" TEXT NOT NULL DEFAULT 'home';
ALTER TABLE "FitnessProfile" ADD COLUMN "healthClearance" BOOLEAN NOT NULL DEFAULT false;
