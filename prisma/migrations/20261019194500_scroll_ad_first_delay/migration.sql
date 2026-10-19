ALTER TABLE "content_source_config"
  ALTER COLUMN "scrollAdDelaySeconds" SET DEFAULT 120;

UPDATE "content_source_config"
SET "scrollAdDelaySeconds" = 120
WHERE "scrollAdDelaySeconds" = 30;
