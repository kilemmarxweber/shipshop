CREATE TABLE IF NOT EXISTS "product_share" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_share_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_share_userId_productId_key" ON "product_share"("userId", "productId");
CREATE INDEX IF NOT EXISTS "product_share_productId_idx" ON "product_share"("productId");

ALTER TABLE "product_share" DROP CONSTRAINT IF EXISTS "product_share_userId_fkey";
ALTER TABLE "product_share" ADD CONSTRAINT "product_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_share" DROP CONSTRAINT IF EXISTS "product_share_productId_fkey";
ALTER TABLE "product_share" ADD CONSTRAINT "product_share_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
