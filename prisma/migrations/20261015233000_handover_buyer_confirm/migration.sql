-- CreateEnum value
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'AWAITING_CONFIRM';

-- Table absente de l'init (créée seulement via db push en local)
CREATE TABLE IF NOT EXISTS "pickup_receipt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "scannedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pickup_receipt_orderId_key" ON "pickup_receipt"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "pickup_receipt_code_key" ON "pickup_receipt"("code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pickup_receipt_orderId_fkey'
  ) THEN
    ALTER TABLE "pickup_receipt"
      ADD CONSTRAINT "pickup_receipt_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "pickup_receipt" ADD COLUMN IF NOT EXISTS "scannedAt" TIMESTAMP(3);
