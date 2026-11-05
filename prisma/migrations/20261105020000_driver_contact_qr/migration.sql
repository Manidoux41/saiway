CREATE TYPE "DriverContactChannel" AS ENUM ('WHATSAPP', 'TELEGRAM');

CREATE TABLE "DriverContactQrImage" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "channel" "DriverContactChannel" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverContactQrImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverContactQrImage_driverId_channel_key" ON "DriverContactQrImage"("driverId", "channel");

ALTER TABLE "DriverContactQrImage" ADD CONSTRAINT "DriverContactQrImage_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
