-- Filtre couleur vidéo live (choix host, sync viewers)
ALTER TABLE "creator_live" ADD COLUMN IF NOT EXISTS "videoFilter" TEXT;
