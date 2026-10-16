ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disabledReason" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "nsfwStrikeCount" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE "MediaModerationDecision" AS ENUM ('ALLOW', 'REJECT', 'BAN', 'CSAM_HOLD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "media_moderation_event" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "variant" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "decision" "MediaModerationDecision" NOT NULL,
  "labels" JSONB NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_moderation_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "media_moderation_event_userId_createdAt_idx"
  ON "media_moderation_event"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "media_moderation_event_decision_createdAt_idx"
  ON "media_moderation_event"("decision", "createdAt");

ALTER TABLE "media_moderation_event" DROP CONSTRAINT IF EXISTS "media_moderation_event_userId_fkey";
ALTER TABLE "media_moderation_event" ADD CONSTRAINT "media_moderation_event_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
