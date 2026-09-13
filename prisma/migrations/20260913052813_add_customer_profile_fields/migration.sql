/*
  Warnings:

  - Added the required column `updatedAt` to the `CustomerProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "address" TEXT,
ADD COLUMN     "paymentBrand" TEXT,
ADD COLUMN     "paymentLast4" TEXT,
ADD COLUMN     "paymentProviderCustomerId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
