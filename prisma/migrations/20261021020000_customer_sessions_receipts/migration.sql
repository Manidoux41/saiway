CREATE TABLE "CustomerSession" (
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("tokenHash"),
  CONSTRAINT "CustomerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CustomerSession_userId_idx" ON "CustomerSession"("userId");
CREATE TYPE "CollectionMethod" AS ENUM ('CASH', 'CARD', 'ABA', 'OTHER');
ALTER TABLE "Payment" ADD COLUMN "collectionMethod" "CollectionMethod";
