ALTER TABLE "content_source_config" ADD COLUMN IF NOT EXISTS "scrollAdEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "content_source_config" ADD COLUMN IF NOT EXISTS "scrollAdDelaySeconds" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "content_source_config" ADD COLUMN IF NOT EXISTS "scrollAdStartsAt" TIMESTAMP(3);
ALTER TABLE "content_source_config" ADD COLUMN IF NOT EXISTS "scrollAdEndsAt" TIMESTAMP(3);
ALTER TABLE "content_source_config" ADD COLUMN IF NOT EXISTS "scrollAdVideos" JSONB NOT NULL DEFAULT '["/renard.mp4"]';
