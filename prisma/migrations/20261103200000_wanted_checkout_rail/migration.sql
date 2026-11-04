ALTER TABLE "wanted_request" ADD COLUMN IF NOT EXISTS "paymentRail" TEXT;
ALTER TABLE "wanted_request" ADD COLUMN IF NOT EXISTS "fulfillmentIntent" TEXT;
ALTER TABLE "wanted_request" ADD COLUMN IF NOT EXISTS "matchedAt" TIMESTAMP(3);
ALTER TABLE "wanted_request" ADD COLUMN IF NOT EXISTS "offPlatformWaiverAt" TIMESTAMP(3);
