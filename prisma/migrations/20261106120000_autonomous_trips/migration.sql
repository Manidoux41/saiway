ALTER TABLE "Booking" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Booking"
  ADD COLUMN "passengerName" TEXT,
  ADD COLUMN "originType" TEXT NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "startRequestId" TEXT,
  ADD COLUMN "routeDetails" JSONB,
  ADD COLUMN "estimatedPriceCents" INTEGER,
  ADD COLUMN "pricingStatus" TEXT NOT NULL DEFAULT 'AUTOMATIC',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "actualDurationSeconds" INTEGER,
  ADD COLUMN "driverObservations" TEXT,
  ADD COLUMN "finalLatitude" DECIMAL(10,7),
  ADD COLUMN "finalLongitude" DECIMAL(10,7);
CREATE UNIQUE INDEX "Booking_startRequestId_key" ON "Booking"("startRequestId");
CREATE INDEX "Booking_originType_pickupAt_idx" ON "Booking"("originType", "pickupAt");
ALTER TABLE "PricingRule" ADD COLUMN "policy" JSONB;
