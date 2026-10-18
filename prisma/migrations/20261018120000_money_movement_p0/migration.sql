ALTER TYPE "WalletTxnStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "MoneyMovementKind" AS ENUM ('DEPOSIT', 'P2P_MM', 'P2P_BALANCE');
CREATE TYPE "MoneyMovementStatus" AS ENUM ('CREATED', 'AWAITING_FUNDS', 'POSTED', 'EXPIRED', 'FAILED', 'REJECTED');
CREATE TYPE "NotifyOutboxStatus" AS ENUM ('PENDING', 'SENT', 'DEAD');
CREATE TYPE "PaymentAuditActor" AS ENUM ('USER', 'SYSTEM', 'OWNER');

CREATE TABLE "money_movement" (
    "id" TEXT NOT NULL,
    "kind" "MoneyMovementKind" NOT NULL,
    "status" "MoneyMovementStatus" NOT NULL DEFAULT 'CREATED',
    "payerUserId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "provider" "MobileMoneyProvider" NOT NULL DEFAULT 'INTERNAL',
    "phone" TEXT,
    "clientIdempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "expiresAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "evidenceNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "money_movement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "money_movement_clientIdempotencyKey_key" ON "money_movement"("clientIdempotencyKey");
CREATE UNIQUE INDEX "money_movement_providerReference_key" ON "money_movement"("providerReference");
CREATE INDEX "money_movement_payerUserId_createdAt_idx" ON "money_movement"("payerUserId", "createdAt");
CREATE INDEX "money_movement_status_expiresAt_idx" ON "money_movement"("status", "expiresAt");

ALTER TABLE "money_movement"
  ADD CONSTRAINT "money_movement_payerUserId_fkey"
  FOREIGN KEY ("payerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "money_movement"
  ADD CONSTRAINT "money_movement_beneficiaryUserId_fkey"
  FOREIGN KEY ("beneficiaryUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "notify_outbox" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotifyOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notify_outbox_movementId_eventKey_key" ON "notify_outbox"("movementId", "eventKey");
CREATE INDEX "notify_outbox_status_createdAt_idx" ON "notify_outbox"("status", "createdAt");

ALTER TABLE "notify_outbox"
  ADD CONSTRAINT "notify_outbox_movementId_fkey"
  FOREIGN KEY ("movementId") REFERENCES "money_movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payment_audit" (
    "id" TEXT NOT NULL,
    "movementId" TEXT,
    "actorUserId" TEXT,
    "actorType" "PaymentAuditActor" NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "requestId" TEXT,
    "ip" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_audit_movementId_createdAt_idx" ON "payment_audit"("movementId", "createdAt");
CREATE INDEX "payment_audit_createdAt_idx" ON "payment_audit"("createdAt");

ALTER TABLE "payment_audit"
  ADD CONSTRAINT "payment_audit_movementId_fkey"
  FOREIGN KEY ("movementId") REFERENCES "money_movement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_audit"
  ADD CONSTRAINT "payment_audit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_transaction" ADD COLUMN IF NOT EXISTS "movementId" TEXT;
CREATE INDEX IF NOT EXISTS "wallet_transaction_movementId_idx" ON "wallet_transaction"("movementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transaction_movementId_fkey'
  ) THEN
    ALTER TABLE "wallet_transaction"
      ADD CONSTRAINT "wallet_transaction_movementId_fkey"
      FOREIGN KEY ("movementId") REFERENCES "money_movement"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
