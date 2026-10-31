-- Parole multi-invités : lever la main / accorder le micro
ALTER TABLE "live_guest" ADD COLUMN IF NOT EXISTS "handRaised" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "live_guest" ADD COLUMN IF NOT EXISTS "hasFloor" BOOLEAN NOT NULL DEFAULT false;
