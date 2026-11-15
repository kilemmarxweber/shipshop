-- Anti-scraping: shared API throttle + security events/restrictions (Postgres, no Redis)

CREATE TABLE IF NOT EXISTS "api_throttle" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "api_throttle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_throttle_key_key" ON "api_throttle"("key");

CREATE TABLE IF NOT EXISTS "security_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "endpoint" TEXT,
    "method" TEXT,
    "ipHash" TEXT,
    "userId" TEXT,
    "sessionId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_event_type_createdAt_idx"
  ON "security_event"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "security_event_severity_createdAt_idx"
  ON "security_event"("severity", "createdAt");
CREATE INDEX IF NOT EXISTS "security_event_userId_createdAt_idx"
  ON "security_event"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "security_event_ipHash_createdAt_idx"
  ON "security_event"("ipHash", "createdAt");

CREATE TABLE IF NOT EXISTS "security_restriction" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_restriction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_restriction_scope_subjectKey_expiresAt_idx"
  ON "security_restriction"("scope", "subjectKey", "expiresAt");
CREATE INDEX IF NOT EXISTS "security_restriction_expiresAt_idx"
  ON "security_restriction"("expiresAt");
