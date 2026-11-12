-- Set types (normal / warmup / drop / failure) and superset grouping for session exercises.
ALTER TABLE "WorkoutSet" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "SessionExercise" ADD COLUMN "supersetGroup" TEXT;
