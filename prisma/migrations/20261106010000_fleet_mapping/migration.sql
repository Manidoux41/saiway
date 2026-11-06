CREATE TYPE "VehicleIconCategory" AS ENUM ('TUK_TUK', 'PASSAPP', 'SEDAN', 'SUV', 'MINIVAN', 'MINIBUS', 'VAN', 'OTHER');

ALTER TABLE "Vehicle" ADD COLUMN "iconCategory" "VehicleIconCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "DriverProfile" ADD COLUMN "returningToHub" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DriverLocation" ADD COLUMN "heading" DECIMAL(6,2);
CREATE INDEX "DriverLocation_recordedAt_idx" ON "DriverLocation"("recordedAt");

CREATE TABLE "VehicleIconImage" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleIconImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleIconImage_vehicleId_key" ON "VehicleIconImage"("vehicleId");
CREATE INDEX "Hub_active_name_idx" ON "Hub"("active", "name");

ALTER TABLE "VehicleIconImage" ADD CONSTRAINT "VehicleIconImage_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
