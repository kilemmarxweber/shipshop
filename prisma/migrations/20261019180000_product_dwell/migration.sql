CREATE TABLE IF NOT EXISTS "product_dwell" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "dwellMs" INTEGER NOT NULL DEFAULT 0,
  "viewCount" INTEGER NOT NULL DEFAULT 1,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_dwell_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_dwell_userId_productId_key" ON "product_dwell"("userId", "productId");
CREATE INDEX IF NOT EXISTS "product_dwell_userId_dwellMs_idx" ON "product_dwell"("userId", "dwellMs");
CREATE INDEX IF NOT EXISTS "product_dwell_productId_idx" ON "product_dwell"("productId");

ALTER TABLE "product_dwell"
  ADD CONSTRAINT "product_dwell_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_dwell"
  ADD CONSTRAINT "product_dwell_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
