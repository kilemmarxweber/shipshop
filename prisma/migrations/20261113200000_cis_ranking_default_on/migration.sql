-- Ranking CIS activé par défaut (le consentement utilisateur reste obligatoire)
ALTER TABLE "content_source_config"
  ALTER COLUMN "cisRankingEnabled" SET DEFAULT true;

UPDATE "content_source_config"
SET "cisRankingEnabled" = true
WHERE "id" = 'default';
