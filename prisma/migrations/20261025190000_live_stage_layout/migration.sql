-- Disposition scène + verrou montée invités
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "stageLayout" TEXT NOT NULL DEFAULT 'rail';
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "guestJoinLocked" BOOLEAN NOT NULL DEFAULT false;
