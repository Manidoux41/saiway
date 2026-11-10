CREATE TYPE "VehicleContractKind" AS ENUM ('RENTAL', 'FINANCING');

ALTER TABLE "AccountingEntry" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ForecastLine" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "VehicleContract"
ADD COLUMN "kind" "VehicleContractKind" NOT NULL DEFAULT 'RENTAL',
ADD COLUMN "deletedAt" TIMESTAMP(3);
