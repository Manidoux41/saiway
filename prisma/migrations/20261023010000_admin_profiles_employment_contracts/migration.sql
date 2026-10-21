-- CreateEnum
CREATE TYPE "EmploymentContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED');

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "preferredLanguage" TEXT;

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "address" TEXT,
ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "idDocumentNo" TEXT,
ADD COLUMN     "licenseCategory" TEXT,
ADD COLUMN     "nationality" TEXT;

-- CreateTable
CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "EmploymentContractStatus" NOT NULL DEFAULT 'DRAFT',
    "position" TEXT NOT NULL,
    "workplace" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "probationMonths" INTEGER NOT NULL DEFAULT 0,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 48,
    "monthlySalaryCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "annualLeaveDays" INTEGER NOT NULL DEFAULT 18,
    "additionalTerms" TEXT,
    "activatedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentContract_reference_key" ON "EmploymentContract"("reference");

-- CreateIndex
CREATE INDEX "EmploymentContract_driverId_idx" ON "EmploymentContract"("driverId");

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

