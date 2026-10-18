-- AlterTable
ALTER TABLE "shop" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "wallet" ADD COLUMN "usdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN "cdfCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN "kwCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "wallet" SET "usdCents" = "balanceCents";

-- AlterTable
ALTER TABLE "wallet_transaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
