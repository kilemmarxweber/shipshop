ALTER TABLE "daily_challenge" ADD COLUMN IF NOT EXISTS "productFocus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "daily_challenge" ADD COLUMN IF NOT EXISTS "productTeaser" JSONB;

-- Challenges déjà liés à un produit → focus catalogue
UPDATE "daily_challenge"
SET "productFocus" = 'catalog'
WHERE "productId" IS NOT NULL AND ("productFocus" IS NULL OR "productFocus" = 'none');
