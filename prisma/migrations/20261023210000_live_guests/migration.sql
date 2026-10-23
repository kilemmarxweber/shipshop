-- Invités live : demande → accept/refuse → caméra on/off
CREATE TABLE IF NOT EXISTS "live_guest" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cameraOn" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "live_guest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "live_guest_liveId_userId_key" ON "live_guest"("liveId", "userId");
CREATE INDEX IF NOT EXISTS "live_guest_liveId_status_idx" ON "live_guest"("liveId", "status");

DO $$ BEGIN
  ALTER TABLE "live_guest" ADD CONSTRAINT "live_guest_liveId_fkey"
    FOREIGN KEY ("liveId") REFERENCES "creator_live"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "live_guest" ADD CONSTRAINT "live_guest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
