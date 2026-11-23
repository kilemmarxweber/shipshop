-- Platform fee settings + ledger split columns + new fee kinds

CREATE TABLE IF NOT EXISTS "platform_fee_settings" (
    "id" TEXT NOT NULL,
    "depositFeeBps" INTEGER NOT NULL DEFAULT 500,
    "depositCinetPayBps" INTEGER NOT NULL DEFAULT 300,
    "withdrawFeeBps" INTEGER NOT NULL DEFAULT 500,
    "withdrawCinetPayBps" INTEGER NOT NULL DEFAULT 300,
    "transferExternalFeeBps" INTEGER NOT NULL DEFAULT 500,
    "transferExternalCinetPayBps" INTEGER NOT NULL DEFAULT 300,
    "transferInternalFeeBps" INTEGER NOT NULL DEFAULT 0,
    "saleFeeBpsDefault" INTEGER NOT NULL DEFAULT 500,
    "shippingFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_fee_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_fee_settings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TYPE "PlatformFeeKind" ADD VALUE IF NOT EXISTS 'DEPOSIT';
ALTER TYPE "PlatformFeeKind" ADD VALUE IF NOT EXISTS 'TRANSFER_EXTERNAL';
ALTER TYPE "PlatformFeeKind" ADD VALUE IF NOT EXISTS 'TRANSFER_INTERNAL';

ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "grossFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "providerCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "netAmountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "partnerShareCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "feeBpsSnapshot" INTEGER;
ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "providerBpsSnapshot" INTEGER;

UPDATE "platform_fee"
SET
  "grossFeeCents" = "amountCents",
  "netAmountCents" = "amountCents",
  "providerCostCents" = 0
WHERE "grossFeeCents" = 0 AND "netAmountCents" = 0 AND "amountCents" > 0;
