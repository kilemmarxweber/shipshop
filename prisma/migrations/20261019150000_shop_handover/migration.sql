-- CreateTable
CREATE TABLE "shop_handover" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_handover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_handover_code_key" ON "shop_handover"("code");

-- CreateIndex
CREATE INDEX "shop_handover_shopId_completedAt_idx" ON "shop_handover"("shopId", "completedAt");

-- CreateIndex
CREATE INDEX "shop_handover_buyerId_createdAt_idx" ON "shop_handover"("buyerId", "createdAt");

-- AlterTable
ALTER TABLE "order" ADD COLUMN "handoverId" TEXT;

-- CreateIndex
CREATE INDEX "order_handoverId_idx" ON "order"("handoverId");

-- AddForeignKey
ALTER TABLE "shop_handover" ADD CONSTRAINT "shop_handover_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_handover" ADD CONSTRAINT "shop_handover_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order" ADD CONSTRAINT "order_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "shop_handover"("id") ON DELETE SET NULL ON UPDATE CASCADE;
