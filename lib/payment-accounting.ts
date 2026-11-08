import { Prisma } from "@prisma/client";

export async function recordPaymentRevenue(tx: Prisma.TransactionClient, payment: {
  id: string; bookingId: string; provider: string; amountCents: number; currency: string;
  status: string; confirmedAt: Date | null; updatedAt: Date;
}, confirmedAt = payment.confirmedAt ?? payment.updatedAt) {
  if (payment.status !== "PAID" || payment.provider === "ABA_PAYWAY_SANDBOX") return;
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId }, select: { reference: true, vehicleId: true } });
  await tx.accountingEntry.upsert({
    where: { sourceKey: `payment:${payment.id}` },
    create: {
      sourceKey: `payment:${payment.id}`, type: "REVENUE", category: "TRIP",
      label: booking.reference, amountCents: payment.amountCents, currency: payment.currency,
      entryDate: confirmedAt, paidAt: confirmedAt, vehicleId: booking.vehicleId,
      notes: payment.confirmedAt ? null : "Historical payment date based on last recorded payment update.",
    },
    update: {},
  });
}
