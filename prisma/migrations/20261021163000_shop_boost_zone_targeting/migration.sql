ALTER TABLE "shop_boost"
ADD COLUMN IF NOT EXISTS "targetCity" TEXT,
ADD COLUMN IF NOT EXISTS "targetCommune" TEXT,
ADD COLUMN IF NOT EXISTS "targetQuartier" TEXT,
ADD COLUMN IF NOT EXISTS "targetAvenue" TEXT;

CREATE INDEX IF NOT EXISTS "shop_boost_targetCity_targetCommune_targetQuartier_targ_idx"
ON "shop_boost"("targetCity", "targetCommune", "targetQuartier", "targetAvenue");
