-- AlterEnum
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'PLATFORM_FEE';
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'COURIER_PAYOUT';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PlatformFeeKind" AS ENUM ('SALE', 'SHIPPING', 'WITHDRAWAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WalletBucket" AS ENUM ('BUYER', 'VENDOR', 'COURIER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Wallet pots
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "buyerUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "vendorUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "courierUsdCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "buyerCdfCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "vendorCdfCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "courierCdfCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "buyerKwCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "vendorKwCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "wallet" ADD COLUMN IF NOT EXISTS "courierKwCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "wallet"
SET
  "buyerUsdCents" = "usdCents",
  "buyerCdfCents" = "cdfCents",
  "buyerKwCents" = "kwCents"
WHERE "buyerUsdCents" = 0 AND "vendorUsdCents" = 0 AND "courierUsdCents" = 0
  AND "buyerCdfCents" = 0 AND "vendorCdfCents" = 0 AND "courierCdfCents" = 0
  AND "buyerKwCents" = 0 AND "vendorKwCents" = 0 AND "courierKwCents" = 0;

-- Order fee columns
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "saleFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shippingFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shippingFeePending" BOOLEAN NOT NULL DEFAULT false;

-- Courier KYC
CREATE TABLE IF NOT EXISTS "courier_company" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "rccm" TEXT,
  "idnat" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "courier_company_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "postnom" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "passportPhotoUrl" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "idFrontUrl" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "idBackUrl" TEXT;
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "courier" ADD COLUMN IF NOT EXISTS "archivedReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "courier_userId_key" ON "courier"("userId");
CREATE INDEX IF NOT EXISTS "courier_companyId_idx" ON "courier"("companyId");
CREATE INDEX IF NOT EXISTS "courier_archivedAt_idx" ON "courier"("archivedAt");

DO $$ BEGIN
  ALTER TABLE "courier" ADD CONSTRAINT "courier_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "courier" ADD CONSTRAINT "courier_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "courier_company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "platform_treasury" (
  "id" TEXT NOT NULL DEFAULT 'chipshop',
  "usdCents" INTEGER NOT NULL DEFAULT 0,
  "cdfCents" INTEGER NOT NULL DEFAULT 0,
  "kwCents" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_treasury_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_treasury" ("id") VALUES ('chipshop') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "withdrawal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bucket" "WalletBucket" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "grossCents" INTEGER NOT NULL,
  "feeCents" INTEGER NOT NULL DEFAULT 0,
  "netCents" INTEGER NOT NULL,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "MobileMoneyProvider" NOT NULL,
  "phone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "withdrawal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "withdrawal_userId_status_idx" ON "withdrawal"("userId", "status");

DO $$ BEGIN
  ALTER TABLE "withdrawal" ADD CONSTRAINT "withdrawal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "platform_fee" (
  "id" TEXT NOT NULL,
  "kind" "PlatformFeeKind" NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "amountUsdCents" INTEGER NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "orderId" TEXT,
  "withdrawalId" TEXT,
  "shopId" TEXT,
  "courierId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_fee_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_fee_orderId_kind_key" ON "platform_fee"("orderId", "kind");
CREATE INDEX IF NOT EXISTS "platform_fee_kind_createdAt_idx" ON "platform_fee"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_fee_shopId_idx" ON "platform_fee"("shopId");

DO $$ BEGIN
  ALTER TABLE "platform_fee" ADD CONSTRAINT "platform_fee_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "platform_fee" ADD CONSTRAINT "platform_fee_withdrawalId_fkey"
    FOREIGN KEY ("withdrawalId") REFERENCES "withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "app_notice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "app_notice_userId_readAt_createdAt_idx" ON "app_notice"("userId", "readAt", "createdAt");

DO $$ BEGIN
  ALTER TABLE "app_notice" ADD CONSTRAINT "app_notice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
