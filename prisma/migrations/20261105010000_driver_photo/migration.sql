-- CreateTable
CREATE TABLE "DriverPhoto" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverPhoto_driverId_key" ON "DriverPhoto"("driverId");

-- AddForeignKey
ALTER TABLE "DriverPhoto" ADD CONSTRAINT "DriverPhoto_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
