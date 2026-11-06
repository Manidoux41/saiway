-- This discards push subscriptions/delivery history, but never bookings or GPS history.
-- Prefer fixing configuration forward; take a backup before any rollback.
BEGIN;
DROP TABLE "PushDelivery";
DROP TABLE "PushSubscription";
ALTER TABLE "DriverProfile" DROP COLUMN "lastMovementPushAt";
COMMIT;
