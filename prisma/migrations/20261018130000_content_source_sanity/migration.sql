CREATE TABLE IF NOT EXISTS "content_source_config" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "nsfwReview" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_source_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "media_review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_review_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_review_status_createdAt_idx" ON "media_review"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_review_userId_fkey'
  ) THEN
    ALTER TABLE "media_review"
      ADD CONSTRAINT "media_review_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
