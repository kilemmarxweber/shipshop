-- Interrupteur owner : challenges visibles feed / Découvrir
ALTER TABLE "content_source_config"
  ADD COLUMN IF NOT EXISTS "challengesEnabled" BOOLEAN NOT NULL DEFAULT false;
