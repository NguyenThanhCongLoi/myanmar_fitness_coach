-- Additive: step-by-step instructions (en/my, optional image + credit) per exercise.
ALTER TABLE "Exercise" ADD COLUMN "steps" JSONB NOT NULL DEFAULT '[]';
-- Per-location (home/gym) form cues: {perSide, home:[{en,my}], gym:[{en,my}]}.
ALTER TABLE "Exercise" ADD COLUMN "guidance" JSONB NOT NULL DEFAULT '{}';
