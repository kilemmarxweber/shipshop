-- Challenges programmés (publiés) vs brouillons catalogue
ALTER TABLE "daily_challenge" ADD COLUMN IF NOT EXISTS "programmed" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "daily_challenge_programmed_startsAt_endsAt_idx"
  ON "daily_challenge"("programmed", "startsAt", "endsAt");
