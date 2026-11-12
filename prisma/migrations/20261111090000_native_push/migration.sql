ALTER TABLE "PushSubscription" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'WEB';
ALTER TABLE "PushSubscription" ADD COLUMN "platform" TEXT;
ALTER TABLE "PushDelivery" ADD COLUMN "pushTicketId" TEXT;
ALTER TABLE "PushDelivery" ADD COLUMN "receiptCheckedAt" TIMESTAMP(3);
CREATE INDEX "PushDelivery_pushTicketId_receiptCheckedAt_idx" ON "PushDelivery"("pushTicketId", "receiptCheckedAt");
CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolution" TEXT,
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AccountDeletionRequest_userId_status_idx" ON "AccountDeletionRequest"("userId", "status");
