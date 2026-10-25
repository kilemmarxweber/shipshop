-- Micro host + invités
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "micOn" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "live_guest" ADD COLUMN IF NOT EXISTS "micOn" BOOLEAN NOT NULL DEFAULT false;

-- Signalisation WebRTC (offre / réponse / ICE) entre peers du live
CREATE TABLE IF NOT EXISTS "live_rtc_signal" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "fromPeerId" TEXT NOT NULL,
    "toPeerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "live_rtc_signal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "live_rtc_signal_liveId_toPeerId_consumedAt_idx"
  ON "live_rtc_signal"("liveId", "toPeerId", "consumedAt");
CREATE INDEX IF NOT EXISTS "live_rtc_signal_createdAt_idx"
  ON "live_rtc_signal"("createdAt");

DO $$ BEGIN
  ALTER TABLE "live_rtc_signal" ADD CONSTRAINT "live_rtc_signal_liveId_fkey"
    FOREIGN KEY ("liveId") REFERENCES "creator_live"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
