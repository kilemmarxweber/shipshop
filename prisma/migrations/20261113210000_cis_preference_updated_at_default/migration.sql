-- createMany does not send @updatedAt. The original column is NOT NULL
-- without a default, so a batch insert fails unless the app supplies the value.
ALTER TABLE "cis_preference"
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
