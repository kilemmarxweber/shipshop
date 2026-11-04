-- Event: taux du jour figés à la création (affichage multi-devises billetterie)
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "fxCdfPerUsd" INTEGER NOT NULL DEFAULT 2400;
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "fxKwPerUsd" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "fxRateUpdatedAt" TIMESTAMP(3);

-- Daily challenge lié à un événement billetterie
ALTER TABLE "daily_challenge" ADD COLUMN IF NOT EXISTS "eventId" TEXT;

CREATE INDEX IF NOT EXISTS "daily_challenge_eventId_idx" ON "daily_challenge"("eventId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_challenge_eventId_fkey'
  ) THEN
    ALTER TABLE "daily_challenge"
      ADD CONSTRAINT "daily_challenge_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "event"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
