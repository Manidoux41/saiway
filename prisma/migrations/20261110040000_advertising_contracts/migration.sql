CREATE TYPE "AdvertisingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "AdvertisingPlacement" AS ENUM ('HOME', 'BLOG', 'BOOKING', 'DRIVER');

CREATE TABLE "AdvertisingContract" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "advertiser" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "placements" "AdvertisingPlacement"[] NOT NULL,
  "status" "AdvertisingStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "terms" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvertisingContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdvertisingContract_dates_check" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "AdvertisingContract_amount_check" CHECK ("amountCents" >= 0 AND "currency" = 'USD')
);

CREATE TABLE "AdvertisingImage" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvertisingImage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdvertisingContract_reference_key" ON "AdvertisingContract"("reference");
CREATE INDEX "AdvertisingContract_status_startsAt_endsAt_idx" ON "AdvertisingContract"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "AdvertisingImage_contractId_key" ON "AdvertisingImage"("contractId");
ALTER TABLE "AdvertisingImage" ADD CONSTRAINT "AdvertisingImage_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "AdvertisingContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
