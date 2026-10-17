-- CreateEnum
CREATE TYPE "WantedCondition" AS ENUM ('NEW_SHOP', 'USED');
CREATE TYPE "WantedRequestStatus" AS ENUM ('OPEN', 'MATCHED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "WantedOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "shop" ADD COLUMN IF NOT EXISTS "isOccasionStall" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "wantedRequestId" TEXT;
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "wantedRequestId" TEXT;

-- CreateTable
CREATE TABLE "wanted_request" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "budgetCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "condition" "WantedCondition" NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Kinshasa',
    "commune" TEXT,
    "quartier" TEXT,
    "avenue" TEXT,
    "status" "WantedRequestStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wanted_request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wanted_offer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sellerUserId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "message" TEXT,
    "priceCents" INTEGER NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "condition" "WantedCondition" NOT NULL,
    "sellerAddress" TEXT,
    "sellerCommune" TEXT,
    "sellerQuartier" TEXT,
    "sellerAvenue" TEXT,
    "sellerLat" DOUBLE PRECISION,
    "sellerLng" DOUBLE PRECISION,
    "status" "WantedOfferStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wanted_offer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wanted_request_acceptedOfferId_key" ON "wanted_request"("acceptedOfferId");
CREATE INDEX "wanted_request_status_createdAt_idx" ON "wanted_request"("status", "createdAt");
CREATE INDEX "wanted_request_buyerId_status_idx" ON "wanted_request"("buyerId", "status");
CREATE INDEX "wanted_request_category_status_idx" ON "wanted_request"("category", "status");

CREATE UNIQUE INDEX "wanted_offer_productId_key" ON "wanted_offer"("productId");
CREATE UNIQUE INDEX "wanted_offer_requestId_sellerUserId_key" ON "wanted_offer"("requestId", "sellerUserId");
CREATE INDEX "wanted_offer_requestId_status_idx" ON "wanted_offer"("requestId", "status");
CREATE INDEX "wanted_offer_sellerUserId_idx" ON "wanted_offer"("sellerUserId");

CREATE UNIQUE INDEX "product_wantedRequestId_key" ON "product"("wantedRequestId");
CREATE INDEX "conversation_wantedRequestId_idx" ON "conversation"("wantedRequestId");

ALTER TABLE "wanted_request" ADD CONSTRAINT "wanted_request_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wanted_offer" ADD CONSTRAINT "wanted_offer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "wanted_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wanted_offer" ADD CONSTRAINT "wanted_offer_sellerUserId_fkey" FOREIGN KEY ("sellerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wanted_offer" ADD CONSTRAINT "wanted_offer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wanted_offer" ADD CONSTRAINT "wanted_offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wanted_request" ADD CONSTRAINT "wanted_request_acceptedOfferId_fkey" FOREIGN KEY ("acceptedOfferId") REFERENCES "wanted_offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product" ADD CONSTRAINT "product_wantedRequestId_fkey" FOREIGN KEY ("wantedRequestId") REFERENCES "wanted_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_wantedRequestId_fkey" FOREIGN KEY ("wantedRequestId") REFERENCES "wanted_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
