-- Training days are user-chosen; the 3-day default is only a placeholder until the user picks.
ALTER TABLE "GameState" ADD COLUMN "scheduleChosen" BOOLEAN NOT NULL DEFAULT false;
