-- CreateEnum
CREATE TYPE "LicenseSide" AS ENUM ('FRONT', 'BACK');

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN "licenseExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "contactPhone" TEXT;

-- CreateTable
CREATE TABLE "DriverLicenseImage" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "side" "LicenseSide" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverLicenseImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverLicenseImage_driverId_side_key" ON "DriverLicenseImage"("driverId", "side");

-- AddForeignKey
ALTER TABLE "DriverLicenseImage" ADD CONSTRAINT "DriverLicenseImage_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
