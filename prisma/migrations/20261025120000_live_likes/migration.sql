-- Compteur j'aime (double-tap / btn cœur viewers)
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "likeCount" INTEGER NOT NULL DEFAULT 0;
