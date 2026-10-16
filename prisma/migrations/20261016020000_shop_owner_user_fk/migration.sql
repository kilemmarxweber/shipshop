-- Enforce shop.ownerUserId → user.id (optional; SET NULL if the user is deleted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shop_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "shop"
      ADD CONSTRAINT "shop_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
