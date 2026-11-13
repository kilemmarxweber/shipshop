-- Suppression de conversation par participant (masquage par côté)
ALTER TABLE "conversation"
  ADD COLUMN IF NOT EXISTS "buyerDeletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sellerDeletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "conversation_buyerDeletedAt_idx"
  ON "conversation"("buyerDeletedAt");

CREATE INDEX IF NOT EXISTS "conversation_sellerDeletedAt_idx"
  ON "conversation"("sellerDeletedAt");
