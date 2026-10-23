ALTER TABLE "challenge_completion" ADD COLUMN IF NOT EXISTS "reference" TEXT;

UPDATE "challenge_completion" AS c
SET "reference" = 'CHL-' || UPPER(SUBSTRING(MD5(c."id") FROM 1 FOR 8))
WHERE c."reference" IS NULL OR c."reference" = '';

-- Garantit l’unicité même si un UPDATE partiel a déjà tourné
UPDATE "challenge_completion" AS c
SET "reference" = 'CHL-' || UPPER(SUBSTRING(MD5(c."id") FROM 1 FOR 8));

ALTER TABLE "challenge_completion" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "challenge_completion_reference_key"
  ON "challenge_completion"("reference");

CREATE INDEX IF NOT EXISTS "challenge_completion_challengeId_createdAt_idx"
  ON "challenge_completion"("challengeId", "createdAt");
