CREATE TYPE "AccountingCategory" AS ENUM ('TRIP', 'FUEL', 'MAINTENANCE', 'SALARY', 'OTHER');
CREATE TYPE "VehicleExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PAID');

ALTER TABLE "AccountingEntry"
 ADD COLUMN "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "category" "AccountingCategory" NOT NULL DEFAULT 'OTHER',
 ADD COLUMN "sourceKey" TEXT,
 ADD COLUMN "vehicleId" TEXT;
UPDATE "AccountingEntry" SET "entryDate" = COALESCE("paidAt", "createdAt");
CREATE UNIQUE INDEX "AccountingEntry_sourceKey_key" ON "AccountingEntry"("sourceKey");
CREATE INDEX "AccountingEntry_entryDate_type_category_idx" ON "AccountingEntry"("entryDate", "type", "category");
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "confirmedAt" TIMESTAMP(3);

CREATE TABLE "VehicleExpense" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "requestId" TEXT NOT NULL,
 "driverId" TEXT,
 "vehicleId" TEXT NOT NULL,
 "category" "AccountingCategory" NOT NULL,
 "occurredAt" TIMESTAMP(3) NOT NULL,
 "odometerKm" DECIMAL(12,1) NOT NULL,
 "liters" DECIMAL(10,3),
 "amountCents" INTEGER NOT NULL,
 "currency" TEXT NOT NULL,
 "khrPerUsd" DECIMAL(12,4),
 "usdCents" INTEGER NOT NULL,
 "fullTank" BOOLEAN NOT NULL DEFAULT false,
 "notes" TEXT,
 "status" "VehicleExpenseStatus" NOT NULL DEFAULT 'PENDING',
 "reviewedAt" TIMESTAMP(3),
 "reviewedBy" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "VehicleExpense_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VehicleExpense_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "VehicleExpense_values_check" CHECK ("category" IN ('FUEL','MAINTENANCE') AND "odometerKm" >= 0 AND "amountCents" > 0 AND "usdCents" > 0 AND ("category" <> 'FUEL' OR ("liters" IS NOT NULL AND "liters" > 0)) AND ("currency" = 'USD' OR ("currency" = 'KHR' AND "khrPerUsd" IS NOT NULL AND "khrPerUsd" > 0)))
);
CREATE UNIQUE INDEX "VehicleExpense_requestId_key" ON "VehicleExpense"("requestId");
CREATE INDEX "VehicleExpense_vehicleId_occurredAt_idx" ON "VehicleExpense"("vehicleId","occurredAt");
CREATE INDEX "VehicleExpense_driverId_status_idx" ON "VehicleExpense"("driverId","status");

CREATE TABLE "Payroll" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "driverId" TEXT NOT NULL,
 "month" TEXT NOT NULL,
 "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
 "commissionBps" INTEGER NOT NULL DEFAULT 8000,
 "baseSalaryCents" INTEGER NOT NULL,
 "eligibleRevenueCents" INTEGER NOT NULL,
 "commissionCents" INTEGER NOT NULL,
 "bonusCents" INTEGER NOT NULL DEFAULT 0,
 "deductionCents" INTEGER NOT NULL DEFAULT 0,
 "netCents" INTEGER NOT NULL,
 "currency" TEXT NOT NULL DEFAULT 'USD',
 "adjustmentNotes" TEXT,
 "snapshot" JSONB NOT NULL,
 "scheduledPayAt" TIMESTAMP(3) NOT NULL,
 "finalizedAt" TIMESTAMP(3),
 "paidAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Payroll_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Payroll_values_check" CHECK ("commissionBps" BETWEEN 0 AND 10000 AND "baseSalaryCents" >= 0 AND "eligibleRevenueCents" >= 0 AND "commissionCents" >= 0 AND "bonusCents" >= 0 AND "deductionCents" >= 0 AND "netCents" >= 0 AND "netCents" = "baseSalaryCents" + "commissionCents" + "bonusCents" - "deductionCents" AND "currency" = 'USD')
);
CREATE UNIQUE INDEX "Payroll_driverId_month_key" ON "Payroll"("driverId","month");
CREATE INDEX "Payroll_month_status_idx" ON "Payroll"("month","status");
