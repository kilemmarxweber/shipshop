-- AlterEnum
ALTER TYPE "PlatformFeeKind" ADD VALUE IF NOT EXISTS 'TICKET';

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ON_SALE', 'CLOSED', 'CANCELLED', 'ENDED');
CREATE TYPE "EventOrganizerKind" AS ENUM ('ARTIST', 'ORGANIZATION');
CREATE TYPE "PlatformTicketFeeMode" AS ENUM ('PERCENT', 'FLAT');
CREATE TYPE "TicketStatus" AS ENUM ('PAID', 'CHECKED_IN', 'REFUNDED', 'VOID');
CREATE TYPE "TicketRefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "venue" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capacity" INTEGER,
    "accessNote" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "organizerKind" "EventOrganizerKind" NOT NULL DEFAULT 'ARTIST',
    "organizerName" TEXT NOT NULL,
    "organizerUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "platformFeeMode" "PlatformTicketFeeMode" NOT NULL DEFAULT 'PERCENT',
    "platformFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "salesStartsAt" TIMESTAMP(3),
    "salesEndsAt" TIMESTAMP(3),
    "accessStartsAt" TIMESTAMP(3),
    "accessEndsAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_type" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "quota" INTEGER NOT NULL,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_type_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'PAID',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchaseCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "organizerCents" INTEGER NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "qrHmac" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "settledAt" TIMESTAMP(3),
    "clawbackFailed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_refund_request" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TicketRefundStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_refund_request_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "brand_campaign" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "platform_fee" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ticket_code_key" ON "ticket"("code");
CREATE INDEX IF NOT EXISTS "event_status_startsAt_idx" ON "event"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "event_organizerUserId_idx" ON "event"("organizerUserId");
CREATE INDEX IF NOT EXISTS "event_createdByUserId_idx" ON "event"("createdByUserId");
CREATE INDEX IF NOT EXISTS "ticket_type_eventId_idx" ON "ticket_type"("eventId");
CREATE INDEX IF NOT EXISTS "ticket_eventId_status_idx" ON "ticket"("eventId", "status");
CREATE INDEX IF NOT EXISTS "ticket_buyerUserId_createdAt_idx" ON "ticket"("buyerUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "ticket_qrHmac_idx" ON "ticket"("qrHmac");
CREATE INDEX IF NOT EXISTS "ticket_refund_request_status_createdAt_idx" ON "ticket_refund_request"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ticket_refund_request_ticketId_idx" ON "ticket_refund_request"("ticketId");
CREATE INDEX IF NOT EXISTS "brand_campaign_eventId_idx" ON "brand_campaign"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_fee_ticketId_kind_key" ON "platform_fee"("ticketId", "kind");

ALTER TABLE "event" ADD CONSTRAINT "event_organizerUserId_fkey" FOREIGN KEY ("organizerUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event" ADD CONSTRAINT "event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_type" ADD CONSTRAINT "ticket_type_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ticket_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_refund_request" ADD CONSTRAINT "ticket_refund_request_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_refund_request" ADD CONSTRAINT "ticket_refund_request_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_refund_request" ADD CONSTRAINT "ticket_refund_request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "brand_campaign" ADD CONSTRAINT "brand_campaign_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_fee" ADD CONSTRAINT "platform_fee_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
