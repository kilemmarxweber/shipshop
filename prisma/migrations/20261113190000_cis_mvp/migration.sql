-- CIS MVP: consentements, événements, préférences, recos, audit admin + flag ranking

ALTER TABLE "content_source_config"
ADD COLUMN IF NOT EXISTS "cisRankingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "cis_consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cis_consent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cis_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "productId" TEXT,
    "shopId" TEXT,
    "category" TEXT,
    "query" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cis_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cis_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cis_preference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cis_recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "surface" TEXT NOT NULL DEFAULT 'foryou',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "cis_recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cis_admin_audit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cis_admin_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cis_consent_userId_decidedAt_idx" ON "cis_consent"("userId", "decidedAt");
CREATE INDEX IF NOT EXISTS "cis_consent_userId_status_idx" ON "cis_consent"("userId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "cis_event_userId_clientEventId_key" ON "cis_event"("userId", "clientEventId");
CREATE INDEX IF NOT EXISTS "cis_event_userId_occurredAt_idx" ON "cis_event"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "cis_event_type_occurredAt_idx" ON "cis_event"("type", "occurredAt");
CREATE INDEX IF NOT EXISTS "cis_event_productId_idx" ON "cis_event"("productId");
CREATE INDEX IF NOT EXISTS "cis_event_shopId_idx" ON "cis_event"("shopId");

CREATE UNIQUE INDEX IF NOT EXISTS "cis_preference_userId_kind_key_key" ON "cis_preference"("userId", "kind", "key");
CREATE INDEX IF NOT EXISTS "cis_preference_userId_score_idx" ON "cis_preference"("userId", "score");

CREATE INDEX IF NOT EXISTS "cis_recommendation_userId_surface_score_idx" ON "cis_recommendation"("userId", "surface", "score");
CREATE INDEX IF NOT EXISTS "cis_recommendation_productId_idx" ON "cis_recommendation"("productId");

CREATE INDEX IF NOT EXISTS "cis_admin_audit_actorUserId_createdAt_idx" ON "cis_admin_audit"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "cis_admin_audit_targetUserId_createdAt_idx" ON "cis_admin_audit"("targetUserId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "cis_consent" ADD CONSTRAINT "cis_consent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cis_event" ADD CONSTRAINT "cis_event_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cis_preference" ADD CONSTRAINT "cis_preference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cis_recommendation" ADD CONSTRAINT "cis_recommendation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cis_admin_audit" ADD CONSTRAINT "cis_admin_audit_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cis_admin_audit" ADD CONSTRAINT "cis_admin_audit_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
