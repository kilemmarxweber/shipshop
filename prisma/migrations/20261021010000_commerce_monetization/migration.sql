-- AlterTable
ALTER TABLE "shop" ADD COLUMN IF NOT EXISTS "proUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "creatorCommissionBps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "saleFeeBps" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "attributedCreatorId" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "creatorFeeCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "commerce_funnel_event" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "productId" TEXT,
    "userId" TEXT,
    "wantedId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commerce_funnel_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "shop_boost" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "days" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_boost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_creator_share" (
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_creator_share_pkey" PRIMARY KEY ("productId","userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "brand_campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FEED',
    "category" TEXT,
    "budgetCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerUserId" TEXT,

    CONSTRAINT "brand_campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "commerce_funnel_event_kind_createdAt_idx" ON "commerce_funnel_event"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "commerce_funnel_event_productId_kind_idx" ON "commerce_funnel_event"("productId", "kind");
CREATE INDEX IF NOT EXISTS "shop_boost_productId_endsAt_idx" ON "shop_boost"("productId", "endsAt");
CREATE INDEX IF NOT EXISTS "shop_boost_shopId_endsAt_idx" ON "shop_boost"("shopId", "endsAt");
CREATE INDEX IF NOT EXISTS "product_creator_share_userId_idx" ON "product_creator_share"("userId");
CREATE INDEX IF NOT EXISTS "brand_campaign_status_startsAt_idx" ON "brand_campaign"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "order_attributedCreatorId_idx" ON "order"("attributedCreatorId");

ALTER TABLE "commerce_funnel_event" DROP CONSTRAINT IF EXISTS "commerce_funnel_event_productId_fkey";
ALTER TABLE "commerce_funnel_event" ADD CONSTRAINT "commerce_funnel_event_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commerce_funnel_event" DROP CONSTRAINT IF EXISTS "commerce_funnel_event_userId_fkey";
ALTER TABLE "commerce_funnel_event" ADD CONSTRAINT "commerce_funnel_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shop_boost" DROP CONSTRAINT IF EXISTS "shop_boost_shopId_fkey";
ALTER TABLE "shop_boost" ADD CONSTRAINT "shop_boost_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_boost" DROP CONSTRAINT IF EXISTS "shop_boost_productId_fkey";
ALTER TABLE "shop_boost" ADD CONSTRAINT "shop_boost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_creator_share" DROP CONSTRAINT IF EXISTS "product_creator_share_productId_fkey";
ALTER TABLE "product_creator_share" ADD CONSTRAINT "product_creator_share_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_creator_share" DROP CONSTRAINT IF EXISTS "product_creator_share_userId_fkey";
ALTER TABLE "product_creator_share" ADD CONSTRAINT "product_creator_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brand_campaign" DROP CONSTRAINT IF EXISTS "brand_campaign_ownerUserId_fkey";
ALTER TABLE "brand_campaign" ADD CONSTRAINT "brand_campaign_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_attributedCreatorId_fkey";
ALTER TABLE "order" ADD CONSTRAINT "order_attributedCreatorId_fkey" FOREIGN KEY ("attributedCreatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
