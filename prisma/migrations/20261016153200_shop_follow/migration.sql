CREATE TABLE IF NOT EXISTS "shop_follow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_follow_userId_shopId_key" ON "shop_follow"("userId", "shopId");
CREATE INDEX IF NOT EXISTS "shop_follow_shopId_idx" ON "shop_follow"("shopId");

ALTER TABLE "shop_follow" DROP CONSTRAINT IF EXISTS "shop_follow_userId_fkey";
ALTER TABLE "shop_follow" ADD CONSTRAINT "shop_follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_follow" DROP CONSTRAINT IF EXISTS "shop_follow_shopId_fkey";
ALTER TABLE "shop_follow" ADD CONSTRAINT "shop_follow_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
