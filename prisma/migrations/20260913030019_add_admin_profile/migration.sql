-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT true,
    "canManageFleet" BOOLEAN NOT NULL DEFAULT true,
    "canManagePrices" BOOLEAN NOT NULL DEFAULT true,
    "canManageBookings" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
