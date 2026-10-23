-- Brand campaign packs + tracking
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "objective" TEXT NOT NULL DEFAULT 'DISCOVERY';
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "impressions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "clicks" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "conversions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "ctaUrl" TEXT;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "body" TEXT;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "influencerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "brand_campaign_objective_status_idx"
  ON "brand_campaign"("objective", "status");

ALTER TABLE "brand_campaign" DROP CONSTRAINT IF EXISTS "brand_campaign_influencerUserId_fkey";
ALTER TABLE "brand_campaign" ADD CONSTRAINT "brand_campaign_influencerUserId_fkey"
  FOREIGN KEY ("influencerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Account badges
CREATE TABLE IF NOT EXISTS "account_badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lostAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cycleKey" TEXT,

    CONSTRAINT "account_badge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_badge_userId_kind_key" ON "account_badge"("userId", "kind");
CREATE INDEX IF NOT EXISTS "account_badge_kind_active_idx" ON "account_badge"("kind", "active");

ALTER TABLE "account_badge" DROP CONSTRAINT IF EXISTS "account_badge_userId_fkey";
ALTER TABLE "account_badge" ADD CONSTRAINT "account_badge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Activity days
CREATE TABLE IF NOT EXISTS "user_activity_day" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "interactions" INTEGER NOT NULL DEFAULT 0,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_day_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_activity_day_userId_day_key" ON "user_activity_day"("userId", "day");
CREATE INDEX IF NOT EXISTS "user_activity_day_day_interactions_idx" ON "user_activity_day"("day", "interactions");
CREATE INDEX IF NOT EXISTS "user_activity_day_city_day_idx" ON "user_activity_day"("city", "day");

ALTER TABLE "user_activity_day" DROP CONSTRAINT IF EXISTS "user_activity_day_userId_fkey";
ALTER TABLE "user_activity_day" ADD CONSTRAINT "user_activity_day_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Missions
CREATE TABLE IF NOT EXISTS "user_mission_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "user_mission_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_mission_progress_userId_missionKey_periodKey_key"
  ON "user_mission_progress"("userId", "missionKey", "periodKey");
CREATE INDEX IF NOT EXISTS "user_mission_progress_periodKey_completedAt_idx"
  ON "user_mission_progress"("periodKey", "completedAt");

ALTER TABLE "user_mission_progress" DROP CONSTRAINT IF EXISTS "user_mission_progress_userId_fkey";
ALTER TABLE "user_mission_progress" ADD CONSTRAINT "user_mission_progress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rewards
CREATE TABLE IF NOT EXISTS "reward_grant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "reward_grant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reward_grant_userId_createdAt_idx" ON "reward_grant"("userId", "createdAt");

ALTER TABLE "reward_grant" DROP CONSTRAINT IF EXISTS "reward_grant_userId_fkey";
ALTER TABLE "reward_grant" ADD CONSTRAINT "reward_grant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Creator follows
CREATE TABLE IF NOT EXISTS "user_follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_follow_followerId_creatorId_key" ON "user_follow"("followerId", "creatorId");
CREATE INDEX IF NOT EXISTS "user_follow_creatorId_idx" ON "user_follow"("creatorId");

ALTER TABLE "user_follow" DROP CONSTRAINT IF EXISTS "user_follow_followerId_fkey";
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_follow" DROP CONSTRAINT IF EXISTS "user_follow_creatorId_fkey";
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Daily challenge
CREATE TABLE IF NOT EXISTS "daily_challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "sponsorCampaignId" TEXT,
    "completions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "daily_challenge_startsAt_endsAt_idx" ON "daily_challenge"("startsAt", "endsAt");

ALTER TABLE "daily_challenge" DROP CONSTRAINT IF EXISTS "daily_challenge_sponsorCampaignId_fkey";
ALTER TABLE "daily_challenge" ADD CONSTRAINT "daily_challenge_sponsorCampaignId_fkey"
  FOREIGN KEY ("sponsorCampaignId") REFERENCES "brand_campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "challenge_completion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_completion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "challenge_completion_challengeId_userId_key"
  ON "challenge_completion"("challengeId", "userId");

ALTER TABLE "challenge_completion" DROP CONSTRAINT IF EXISTS "challenge_completion_challengeId_fkey";
ALTER TABLE "challenge_completion" ADD CONSTRAINT "challenge_completion_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "daily_challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "challenge_completion" DROP CONSTRAINT IF EXISTS "challenge_completion_userId_fkey";
ALTER TABLE "challenge_completion" ADD CONSTRAINT "challenge_completion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Live + gifts
CREATE TABLE IF NOT EXISTS "creator_live" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "viewerPeak" INTEGER NOT NULL DEFAULT 0,
    "giftCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "creator_live_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "creator_live_status_startedAt_idx" ON "creator_live"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "creator_live_userId_status_idx" ON "creator_live"("userId", "status");

ALTER TABLE "creator_live" DROP CONSTRAINT IF EXISTS "creator_live_userId_fkey";
ALTER TABLE "creator_live" ADD CONSTRAINT "creator_live_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_live" DROP CONSTRAINT IF EXISTS "creator_live_productId_fkey";
ALTER TABLE "creator_live" ADD CONSTRAINT "creator_live_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "creator_gift" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "liveId" TEXT,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_gift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "creator_gift_toUserId_createdAt_idx" ON "creator_gift"("toUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "creator_gift_liveId_idx" ON "creator_gift"("liveId");

ALTER TABLE "creator_gift" DROP CONSTRAINT IF EXISTS "creator_gift_fromUserId_fkey";
ALTER TABLE "creator_gift" ADD CONSTRAINT "creator_gift_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_gift" DROP CONSTRAINT IF EXISTS "creator_gift_toUserId_fkey";
ALTER TABLE "creator_gift" ADD CONSTRAINT "creator_gift_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_gift" DROP CONSTRAINT IF EXISTS "creator_gift_liveId_fkey";
ALTER TABLE "creator_gift" ADD CONSTRAINT "creator_gift_liveId_fkey"
  FOREIGN KEY ("liveId") REFERENCES "creator_live"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "live_chat_message" (
    "id" TEXT NOT NULL,
    "liveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_chat_message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "live_chat_message_liveId_createdAt_idx" ON "live_chat_message"("liveId", "createdAt");

ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "live_chat_message_liveId_fkey";
ALTER TABLE "live_chat_message" ADD CONSTRAINT "live_chat_message_liveId_fkey"
  FOREIGN KEY ("liveId") REFERENCES "creator_live"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_chat_message" DROP CONSTRAINT IF EXISTS "live_chat_message_userId_fkey";
ALTER TABLE "live_chat_message" ADD CONSTRAINT "live_chat_message_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
