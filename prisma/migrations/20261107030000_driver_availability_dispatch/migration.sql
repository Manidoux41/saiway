ALTER TABLE "DriverProfile"
  ADD COLUMN "availableSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "selectedVehicleId" TEXT;

ALTER TABLE "Booking" ADD COLUMN "dispatchEndsAt" TIMESTAMP(3);

ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_selectedVehicleId_fkey"
  FOREIGN KEY ("selectedVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DriverProfile_isAvailable_availableSince_idx" ON "DriverProfile"("isAvailable", "availableSince");
CREATE INDEX "Booking_driverId_pickupAt_dispatchEndsAt_idx" ON "Booking"("driverId", "pickupAt", "dispatchEndsAt");
CREATE INDEX "Booking_vehicleId_pickupAt_dispatchEndsAt_idx" ON "Booking"("vehicleId", "pickupAt", "dispatchEndsAt");
