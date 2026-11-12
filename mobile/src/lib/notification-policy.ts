import { z } from 'zod';

const notificationData = z.object({
  recipientId: z.string().min(1),
  bookingId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
});
export function notificationDestination(value: unknown, userId: string) {
  const parsed = notificationData.safeParse(value);
  if (!parsed.success || parsed.data.recipientId !== userId) return null;
  return parsed.data.bookingId ? `/trip/${parsed.data.bookingId}` as const : '/trips' as const;
}
