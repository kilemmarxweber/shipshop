-- Fond live temporaire (preset CSS ou image uploadée, purgée à la fin)
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "backdropPreset" TEXT;
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "backdropUrl" TEXT;
