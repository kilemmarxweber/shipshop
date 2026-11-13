INSERT INTO "content_source_config" ("id", "source", "updatedAt", "cisRankingEnabled")
VALUES ('default', 'system', NOW(), true)
ON CONFLICT ("id") DO UPDATE SET "cisRankingEnabled" = true, "updatedAt" = NOW();
