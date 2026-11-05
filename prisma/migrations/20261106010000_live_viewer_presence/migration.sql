CREATE TABLE IF NOT EXISTS "live_viewer_presence" (
  "id" TEXT NOT NULL,
  "liveId" TEXT NOT NULL,
  "peerKey" TEXT NOT NULL,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "imageUrl" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "qualifiedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "live_viewer_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "live_viewer_presence_liveId_peerKey_key"
  ON "live_viewer_presence"("liveId", "peerKey");

CREATE INDEX IF NOT EXISTS "live_viewer_presence_liveId_lastSeenAt_idx"
  ON "live_viewer_presence"("liveId", "lastSeenAt");

CREATE INDEX IF NOT EXISTS "live_viewer_presence_liveId_qualifiedAt_idx"
  ON "live_viewer_presence"("liveId", "qualifiedAt");

DO $$ BEGIN
  ALTER TABLE "live_viewer_presence"
    ADD CONSTRAINT "live_viewer_presence_liveId_fkey"
    FOREIGN KEY ("liveId") REFERENCES "creator_live"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_viewer_presence"
    ADD CONSTRAINT "live_viewer_presence_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
