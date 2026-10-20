import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { checkPaywayPayment, paywayConfig, purchaseFields, trustedCheckoutUrl, validPaywayCallback, type PayWayConfig } from "@/lib/payway";

const selection = z.object({ bookingId: z.string().min(1).max(200) }).strict();
const checkoutSchema = z.object({ status: z.object({ code: z.literal("00"), tran_id: z.string() }), checkout_qr_url: z.string() });
const terminal = ["TRIP_COMPLETED", "CANCELLED", "NO_SHOW", "REFUNDED"];
const noStore = { "Cache-Control": "no-store" };

class PaymentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function configured() {
  const config = paywayConfig();
  if (!config) throw new PaymentError("PAYWAY_NOT_CONFIGURED", 503);
  return config;
}

async function reconcile(id: string, config: PayWayConfig) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.provider !== config.provider) throw new PaymentError("Payment not found", 404);
  if (payment.status === "PAID") return true;
  if (!await checkPaywayPayment(config, { ...payment, id: payment.providerRef ?? payment.id })) {
    await prisma.payment.updateMany({ where: { id, status: "PROCESSING" }, data: { updatedAt: new Date() } });
    return false;
  }
  await prisma.$transaction(async (tx) => {
    const current = await tx.payment.findUnique({ where: { id }, include: { booking: { include: { payments: { select: { id: true, status: true } } } } } });
    if (!current || current.status === "PAID") return;
    const booking = current.booking;
    if (booking.priceCents !== current.amountCents || booking.currency !== current.currency) throw new PaymentError("Payment requires manual review", 409);
    const changed = await tx.payment.updateMany({ where: { id, status: { not: "PAID" } }, data: { status: "PAID" } });
    if (!changed.count) return;
    const duplicate = booking.payments.some((item) => item.id !== id && item.status === "PAID");
    const dispatchable = !duplicate && !terminal.includes(booking.status) && booking.pickupAt.getTime() > Date.now();
    if (dispatchable && booking.status === "PENDING_PAYMENT") {
      await tx.booking.update({ where: { id: booking.id, updatedAt: booking.updatedAt }, data: { status: "CONFIRMED", statusHistory: { create: { status: "CONFIRMED", note: "Payment verified with ABA PayWay" } } } });
    }
    await tx.auditLog.create({ data: { entity: "Booking", entityId: booking.id, action: dispatchable ? "PAYMENT_CONFIRMED" : "PAYMENT_REVIEW_REQUIRED", metadata: { paymentId: id, provider: config.provider } } });
  });
  return true;
}

export async function customerPayment(request: Request, action: "checkout" | "verify") {
  try {
    const account = await authorize(request, "CUSTOMER");
    if (!account) throw new PaymentError("Customer access required", 403);
    const parsed = selection.safeParse(await request.json());
    if (!parsed.success) throw new PaymentError("Invalid payment request");
    const booking = await prisma.booking.findFirst({ where: { id: parsed.data.bookingId, customerId: account.id }, include: { payments: { orderBy: { createdAt: "desc" } } } });
    if (!booking) throw new PaymentError("Booking not found", 404);
    if (booking.payments.some((payment) => payment.status === "PAID")) return Response.json({ paid: true }, { headers: noStore });
    if (terminal.includes(booking.status) || booking.pickupAt.getTime() <= Date.now()) throw new PaymentError("This booking can no longer be paid", 409);
    const config = configured();
    const previous = booking.payments.find((payment) => payment.provider === config.provider && payment.status === "PROCESSING");
    if (action === "verify") {
      const paid = previous && Date.now() - previous.updatedAt.getTime() >= 5000 ? await reconcile(previous.id, config) : false;
      return Response.json({ paid: Boolean(paid) }, { headers: noStore });
    }
    if (previous) {
      if (Date.now() - previous.createdAt.getTime() < 15 * 60_000) {
        if (!previous.checkoutUrl) throw new PaymentError("Checkout is being prepared; retry shortly", 409);
        return Response.json({ paid: false, checkoutUrl: trustedCheckoutUrl(previous.checkoutUrl, config), sandbox: config.sandbox }, { headers: noStore });
      }
      if (await reconcile(previous.id, config)) return Response.json({ paid: true }, { headers: noStore });
      await prisma.payment.updateMany({ where: { id: previous.id, status: "PROCESSING" }, data: { status: "FAILED" } });
    }
    const payment = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findUnique({ where: { id: booking.id }, include: { payments: true } });
      if (!current || current.status !== "PENDING_PAYMENT" || current.payments.some((item) => ["PAID", "PROCESSING"].includes(item.status))) throw new PaymentError("Payment changed; refresh and retry", 409);
      await tx.booking.update({ where: { id: booking.id, updatedAt: booking.updatedAt }, data: { updatedAt: new Date() } });
      const id = randomBytes(10).toString("hex");
      return tx.payment.create({ data: { id, bookingId: booking.id, provider: config.provider, providerRef: id, amountCents: booking.priceCents, currency: booking.currency, status: "PROCESSING" } });
    });
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(purchaseFields(config, payment))) form.set(key, value);
      const response = await fetch(`${config.baseUrl}/api/payment-gateway/v1/payments/purchase`, { method: "POST", body: form, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("Checkout unavailable");
      const checkout = checkoutSchema.parse(await response.json());
      if (checkout.status.tran_id !== payment.id) throw new Error("Invalid checkout transaction");
      const checkoutUrl = trustedCheckoutUrl(checkout.checkout_qr_url, config);
      await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl } });
      return Response.json({ paid: false, checkoutUrl, sandbox: config.sandbox }, { headers: noStore });
    } catch {
      throw new PaymentError("Checkout could not be prepared. Verify payment before retrying.", 503);
    }
  } catch (error) { return paymentFailure(error); }
}

export async function paywayCallback(request: Request) {
  try {
    const config = configured();
    const text = await request.text();
    if (text.length > 8192) throw new PaymentError("Invalid callback", 400);
    const body: unknown = JSON.parse(text);
    if (!validPaywayCallback(body, request.headers.get("x-payway-hmac-sha512") ?? "", config.apiKey)) throw new PaymentError("Invalid callback signature", 401);
    const parsed = z.object({ tran_id: z.string().regex(/^[a-f0-9]{20}$/) }).safeParse(body);
    if (!parsed.success) throw new PaymentError("Invalid transaction");
    const payment = await prisma.payment.findFirst({ where: { providerRef: parsed.data.tran_id, provider: config.provider } });
    if (!payment) throw new PaymentError("Payment not found", 404);
    await reconcile(payment.id, config);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) { return paymentFailure(error); }
}

function paymentFailure(error: unknown) {
  if (error instanceof PaymentError) return Response.json({ error: error.message }, { status: error.status, headers: noStore });
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStore });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Payment changed; retry verification" }, { status: 409, headers: noStore });
  return Response.json({ error: "Payment service unavailable" }, { status: 503, headers: noStore });
}