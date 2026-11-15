-- Owner peut accorder l'accès live hors conditions badge Influenceur
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "liveAccessGrantedAt" TIMESTAMP(3);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "liveAccessGrantedBy" TEXT;
