CREATE TABLE "GuestRideAccess" (
  "tokenHash" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestRideAccess_pkey" PRIMARY KEY ("tokenHash")
);
CREATE UNIQUE INDEX "GuestRideAccess_bookingId_key" ON "GuestRideAccess"("bookingId");
ALTER TABLE "GuestRideAccess" ADD CONSTRAINT "GuestRideAccess_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuestRideLimit" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestRideLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "GuestRideLimit_expiresAt_idx" ON "GuestRideLimit"("expiresAt");
