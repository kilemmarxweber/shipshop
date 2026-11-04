ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "catalogOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "presentedProductId" TEXT;
