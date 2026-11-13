-- Better Auth shared rate-limit + login security counters

CREATE TABLE IF NOT EXISTS "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,
    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rateLimit_key_idx" ON "rateLimit"("key");

CREATE TABLE IF NOT EXISTS "login_security" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lockLevel" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertAt" TIMESTAMP(3),
    "episodeId" TEXT,
    "targetedSubjects" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "login_security_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "login_security_kind_subjectKey_key"
  ON "login_security"("kind", "subjectKey");

CREATE INDEX IF NOT EXISTS "login_security_lockUntil_idx"
  ON "login_security"("lockUntil");
