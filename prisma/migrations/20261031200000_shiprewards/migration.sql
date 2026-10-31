-- AlterEnum
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'SHIPCASH_REWARD';
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'SHIPCASH_CLAWBACK';

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED', 'FLAGGED');

-- AlterTable Product
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "compareAtCents" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "promoPercent" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "promoTier" TEXT;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "activePromoId" TEXT;

-- AlterTable Order
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "promoId" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "promoPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "promoTier" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "compareAtCents" INTEGER;

-- AlterTable ShopBoost
ALTER TABLE "shop_boost" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'PAID';

CREATE INDEX IF NOT EXISTS "product_promoTier_status_idx" ON "product"("promoTier", "status");

CREATE TABLE IF NOT EXISTS "product_promo" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "PromoStatus" NOT NULL DEFAULT 'ACTIVE',
    "compareAtSnapshot" INTEGER NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "clientIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_promo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_promo_shopId_clientIdempotencyKey_key" ON "product_promo"("shopId", "clientIdempotencyKey");
CREATE INDEX IF NOT EXISTS "product_promo_productId_status_idx" ON "product_promo"("productId", "status");
CREATE INDEX IF NOT EXISTS "product_promo_shopId_status_startsAt_idx" ON "product_promo"("shopId", "status", "startsAt");

CREATE TABLE IF NOT EXISTS "product_price_history" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "product_price_history_productId_recordedAt_idx" ON "product_price_history"("productId", "recordedAt");

CREATE TABLE IF NOT EXISTS "ship_point_ledger" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "promoId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ship_point_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ship_point_ledger_orderId_reason_key" ON "ship_point_ledger"("orderId", "reason");
CREATE INDEX IF NOT EXISTS "ship_point_ledger_promoId_idx" ON "ship_point_ledger"("promoId");
CREATE INDEX IF NOT EXISTS "ship_point_ledger_shopId_createdAt_idx" ON "ship_point_ledger"("shopId", "createdAt");

CREATE TABLE IF NOT EXISTS "shop_reward_state" (
    "shopId" TEXT NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "sellerTier" TEXT NOT NULL DEFAULT 'BRONZE',
    "commissionGrantRemaining" INTEGER NOT NULL DEFAULT 0,
    "commissionBpsOff" INTEGER NOT NULL DEFAULT 0,
    "shipCashMonthCents" INTEGER NOT NULL DEFAULT 0,
    "shipCashMonthKey" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shop_reward_state_pkey" PRIMARY KEY ("shopId")
);

ALTER TABLE "product_promo" ADD CONSTRAINT "product_promo_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_promo" ADD CONSTRAINT "product_promo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ship_point_ledger" ADD CONSTRAINT "ship_point_ledger_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ship_point_ledger" ADD CONSTRAINT "ship_point_ledger_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "product_promo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shop_reward_state" ADD CONSTRAINT "shop_reward_state_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
