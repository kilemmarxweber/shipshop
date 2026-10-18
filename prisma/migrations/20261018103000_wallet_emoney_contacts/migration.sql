ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
ALTER TYPE "WalletTxnType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';

CREATE TABLE IF NOT EXISTS "user_money_contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MobileMoneyProvider" NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_money_contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_money_contact_userId_provider_key" ON "user_money_contact"("userId", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "user_money_contact_phone_key" ON "user_money_contact"("phone");
CREATE INDEX IF NOT EXISTS "user_money_contact_userId_idx" ON "user_money_contact"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_money_contact_userId_fkey'
  ) THEN
    ALTER TABLE "user_money_contact"
      ADD CONSTRAINT "user_money_contact_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
