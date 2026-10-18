ALTER TABLE "soundtrack" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "soundtrack_userId_idx" ON "soundtrack"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'soundtrack_userId_fkey'
  ) THEN
    ALTER TABLE "soundtrack"
      ADD CONSTRAINT "soundtrack_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
