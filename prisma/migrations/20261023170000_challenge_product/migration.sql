ALTER TABLE "daily_challenge" ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "daily_challenge_productId_idx" ON "daily_challenge"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_challenge_productId_fkey'
  ) THEN
    ALTER TABLE "daily_challenge"
      ADD CONSTRAINT "daily_challenge_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "product"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
