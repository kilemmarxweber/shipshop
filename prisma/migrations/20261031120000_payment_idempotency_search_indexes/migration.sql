-- Idempotence des opérations financières + index de recherche (ILIKE / filtres)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "withdrawal" ADD COLUMN IF NOT EXISTS "clientIdempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_clientIdempotencyKey_key"
  ON "withdrawal" ("clientIdempotencyKey");
CREATE INDEX IF NOT EXISTS "withdrawal_userId_createdAt_idx"
  ON "withdrawal" ("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_user_bucket_pending_uidx"
  ON "withdrawal" ("userId", "bucket")
  WHERE status = 'PENDING';

ALTER TABLE "creator_gift" ADD COLUMN IF NOT EXISTS "clientIdempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "creator_gift_clientIdempotencyKey_key"
  ON "creator_gift" ("clientIdempotencyKey");
CREATE INDEX IF NOT EXISTS "creator_gift_fromUserId_createdAt_idx"
  ON "creator_gift" ("fromUserId", "createdAt");

CREATE TABLE IF NOT EXISTS "idempotent_operation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "clientKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "httpStatus" INTEGER NOT NULL DEFAULT 0,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotent_operation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotent_operation_userId_scope_clientKey_key"
  ON "idempotent_operation" ("userId", "scope", "clientKey");
CREATE INDEX IF NOT EXISTS "idempotent_operation_scope_createdAt_idx"
  ON "idempotent_operation" ("scope", "createdAt");

DO $$
BEGIN
  ALTER TABLE "idempotent_operation"
    ADD CONSTRAINT "idempotent_operation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Articles : feed + recherche texte
CREATE INDEX IF NOT EXISTS "product_status_createdAt_idx"
  ON "product" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "product_status_category_createdAt_idx"
  ON "product" ("status", "category", "createdAt");
CREATE INDEX IF NOT EXISTS "product_title_trgm_idx"
  ON "product" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "product_description_trgm_idx"
  ON "product" USING gin ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "shop_name_trgm_idx"
  ON "shop" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "user_name_trgm_idx"
  ON "user" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_phone_trgm_idx"
  ON "user" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_money_contact_phone_trgm_idx"
  ON "user_money_contact" USING gin ("phone" gin_trgm_ops);

-- Mouvements / ledger / wallet
CREATE INDEX IF NOT EXISTS "money_movement_status_createdAt_idx"
  ON "money_movement" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "money_movement_beneficiaryUserId_createdAt_idx"
  ON "money_movement" ("beneficiaryUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "money_movement_provider_ref_trgm_idx"
  ON "money_movement" USING gin ("providerReference" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "money_movement_idem_key_trgm_idx"
  ON "money_movement" USING gin ("clientIdempotencyKey" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "wallet_transaction_walletId_type_createdAt_idx"
  ON "wallet_transaction" ("walletId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "wallet_transaction_status_createdAt_idx"
  ON "wallet_transaction" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "payment_audit_requestId_idx"
  ON "payment_audit" ("requestId");

CREATE INDEX IF NOT EXISTS "order_buyerId_status_createdAt_idx"
  ON "order" ("buyerId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "order_status_createdAt_idx"
  ON "order" ("status", "createdAt");
