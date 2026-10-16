-- Catch-up: schema evolved via db push after init. Idempotent so mixed local/prod DBs can deploy.

-- ── Enums ───────────────────────────────────────────────────────────
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

DO $$ BEGIN
  CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'PICKUP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ZoneKind" AS ENUM ('CENTER', 'REMOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderIssueType" AS ENUM ('WRONG_SIZE', 'WRONG_COLOR', 'DEFECT', 'WRONG_PRODUCT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderIssueStatus" AS ENUM ('OPEN', 'SELLER_REPLIED', 'CHANGE_CONFIRMED', 'RESOLVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsappProvider" AS ENUM ('klambo', 'infobip');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MsgChannel" AS ENUM ('whatsapp', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Existing tables: missing columns ────────────────────────────────
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "invitation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "shop" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "shop" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION NOT NULL DEFAULT -4.305;
ALTER TABLE "shop" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION NOT NULL DEFAULT 15.311;

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "productCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "totalCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'PICKUP';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryCity" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryCommune" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryQuartier" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryAvenue" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryParcelle" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryLat" DOUBLE PRECISION;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryLng" DOUBLE PRECISION;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "courierId" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "courierDistanceKm" DOUBLE PRECISION;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "etaMinutes" INTEGER;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "etaAt" TIMESTAMP(3);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "proximityNotifiedAt" TIMESTAMP(3);

-- ── New tables ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "product_like" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_like_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "conversation" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cart_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "delivery_zone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "kind" "ZoneKind" NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "ratePerKmCents" INTEGER NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_zone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "courier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "zoneId" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "courier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_issue" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "OrderIssueType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "OrderIssueStatus" NOT NULL DEFAULT 'OPEN',
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "order_issue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "requiresAck" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "orderIssueId" TEXT,
    "kind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "delivery_event" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messaging_config" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappProvider" "WhatsappProvider" NOT NULL DEFAULT 'klambo',
    "klamboApiKeyEnc" TEXT,
    "klamboBaseUrl" TEXT NOT NULL DEFAULT 'https://whatsapp-api.klambocore.com',
    "klamboDefaultCountry" TEXT NOT NULL DEFAULT 'CD',
    "smsApiKeyEnc" TEXT,
    "smsBaseUrl" TEXT NOT NULL DEFAULT 'https://l2gerd.api.infobip.com',
    "smsSender" TEXT NOT NULL DEFAULT 'ChipShop',
    "waApiKeyEnc" TEXT,
    "waBaseUrl" TEXT NOT NULL DEFAULT 'https://l2gerd.api.infobip.com',
    "waFromNumber" TEXT,
    "notifySms" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "brandPrefix" TEXT NOT NULL DEFAULT 'Chip Shop',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "messaging_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "message_template" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "MsgChannel" NOT NULL DEFAULT 'whatsapp',
    "body" TEXT NOT NULL,
    "infobipTemplateName" TEXT,
    "infobipLanguage" TEXT NOT NULL DEFAULT 'fr',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "message_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notification_log" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "eventKey" TEXT NOT NULL,
    "channel" "MsgChannel" NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "provider" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- ── Indexes ─────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "shop_name_key" ON "shop"("name");
CREATE INDEX IF NOT EXISTS "shop_ownerUserId_idx" ON "shop"("ownerUserId");

CREATE UNIQUE INDEX IF NOT EXISTS "product_like_userId_productId_key" ON "product_like"("userId", "productId");
CREATE INDEX IF NOT EXISTS "product_like_productId_idx" ON "product_like"("productId");

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_buyerId_shopId_key" ON "conversation"("buyerId", "shopId");
CREATE INDEX IF NOT EXISTS "conversation_shopId_idx" ON "conversation"("shopId");

CREATE UNIQUE INDEX IF NOT EXISTS "cart_item_userId_productId_key" ON "cart_item"("userId", "productId");
CREATE INDEX IF NOT EXISTS "cart_item_userId_idx" ON "cart_item"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_zone_commune_key" ON "delivery_zone"("commune");

CREATE INDEX IF NOT EXISTS "courier_isAvailable_idx" ON "courier"("isAvailable");

CREATE INDEX IF NOT EXISTS "order_courierId_idx" ON "order"("courierId");

CREATE INDEX IF NOT EXISTS "order_issue_orderId_status_idx" ON "order_issue"("orderId", "status");
CREATE INDEX IF NOT EXISTS "order_issue_shopId_status_idx" ON "order_issue"("shopId", "status");

CREATE INDEX IF NOT EXISTS "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "message_requiresAck_isUrgent_idx" ON "message"("requiresAck", "isUrgent");

CREATE INDEX IF NOT EXISTS "delivery_event_orderId_createdAt_idx" ON "delivery_event"("orderId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "messaging_config_organizationId_key" ON "messaging_config"("organizationId");

CREATE UNIQUE INDEX IF NOT EXISTS "message_template_organizationId_eventKey_channel_key" ON "message_template"("organizationId", "eventKey", "channel");
CREATE INDEX IF NOT EXISTS "message_template_organizationId_eventKey_idx" ON "message_template"("organizationId", "eventKey");

CREATE INDEX IF NOT EXISTS "notification_log_orderId_eventKey_idx" ON "notification_log"("orderId", "eventKey");

-- ── Foreign keys ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_like_userId_fkey') THEN
    ALTER TABLE "product_like" ADD CONSTRAINT "product_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_like_productId_fkey') THEN
    ALTER TABLE "product_like" ADD CONSTRAINT "product_like_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_buyerId_fkey') THEN
    ALTER TABLE "conversation" ADD CONSTRAINT "conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_shopId_fkey') THEN
    ALTER TABLE "conversation" ADD CONSTRAINT "conversation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_productId_fkey') THEN
    ALTER TABLE "conversation" ADD CONSTRAINT "conversation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_item_userId_fkey') THEN
    ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_item_productId_fkey') THEN
    ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'courier_zoneId_fkey') THEN
    ALTER TABLE "courier" ADD CONSTRAINT "courier_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "delivery_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_zoneId_fkey') THEN
    ALTER TABLE "order" ADD CONSTRAINT "order_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "delivery_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_courierId_fkey') THEN
    ALTER TABLE "order" ADD CONSTRAINT "order_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "courier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_issue_orderId_fkey') THEN
    ALTER TABLE "order_issue" ADD CONSTRAINT "order_issue_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_conversationId_fkey') THEN
    ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_senderId_fkey') THEN
    ALTER TABLE "message" ADD CONSTRAINT "message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_orderIssueId_fkey') THEN
    ALTER TABLE "message" ADD CONSTRAINT "message_orderIssueId_fkey" FOREIGN KEY ("orderIssueId") REFERENCES "order_issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_event_orderId_fkey') THEN
    ALTER TABLE "delivery_event" ADD CONSTRAINT "delivery_event_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_event_actorUserId_fkey') THEN
    ALTER TABLE "delivery_event" ADD CONSTRAINT "delivery_event_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messaging_config_organizationId_fkey') THEN
    ALTER TABLE "messaging_config" ADD CONSTRAINT "messaging_config_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_template_organizationId_fkey') THEN
    ALTER TABLE "message_template" ADD CONSTRAINT "message_template_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_log_orderId_fkey') THEN
    ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
