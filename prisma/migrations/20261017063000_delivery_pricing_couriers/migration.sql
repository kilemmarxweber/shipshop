-- CreateEnum
CREATE TYPE "DeliveryPricingMode" AS ENUM ('PER_KM', 'FLAT_ZONE', 'COMMUNE', 'BUS_STOP');

-- AlterTable DeliveryZone
ALTER TABLE "delivery_zone" ADD COLUMN IF NOT EXISTS "pricingMode" "DeliveryPricingMode" NOT NULL DEFAULT 'PER_KM';
ALTER TABLE "delivery_zone" ADD COLUMN IF NOT EXISTS "flatCents" INTEGER;
ALTER TABLE "delivery_zone" ADD COLUMN IF NOT EXISTS "busStops" JSONB;

-- AlterTable Courier
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "shopId" TEXT;

-- CreateTable ShopDeliveryRate
CREATE TABLE IF NOT EXISTS "shop_delivery_rate" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "zoneId" TEXT,
    "pricingMode" "DeliveryPricingMode" NOT NULL DEFAULT 'PER_KM',
    "baseCents" INTEGER NOT NULL DEFAULT 0,
    "ratePerKmCents" INTEGER NOT NULL DEFAULT 0,
    "flatCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_delivery_rate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_delivery_rate_shopId_zoneId_key" ON "shop_delivery_rate"("shopId", "zoneId");
CREATE INDEX IF NOT EXISTS "shop_delivery_rate_shopId_idx" ON "shop_delivery_rate"("shopId");
CREATE INDEX IF NOT EXISTS "courier_shopId_isAvailable_idx" ON "courier"("shopId", "isAvailable");

DO $$ BEGIN
  ALTER TABLE "courier" ADD CONSTRAINT "courier_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shop_delivery_rate" ADD CONSTRAINT "shop_delivery_rate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "shop_delivery_rate" ADD CONSTRAINT "shop_delivery_rate_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "delivery_zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
