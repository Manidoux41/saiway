import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type PayWayConfig = { merchantId: string; apiKey: string; origin: string; baseUrl: string; provider: string; sandbox: boolean };
export function paywayConfig(): PayWayConfig | null {
  const merchantId = process.env.PAYWAY_MERCHANT_ID;
  const apiKey = process.env.PAYWAY_API_KEY;
  const origin = process.env.PAYWAY_PUBLIC_URL;
  const environment = process.env.PAYWAY_ENVIRONMENT;
  if (!merchantId || !apiKey || !origin || !["sandbox", "production"].includes(environment ?? "")) return null;
  let url: URL;
  try { url = new URL(origin); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
  const sandbox = environment === "sandbox";
  return { merchantId, apiKey, origin: url.origin, sandbox, provider: sandbox ? "ABA_PAYWAY_SANDBOX" : "ABA_PAYWAY", baseUrl: sandbox ? "https://checkout-sandbox.payway.com.kh" : "https://checkout.payway.com.kh" };
}

export function paywayHash(value: string, secret: string) {
  return createHmac("sha512", secret).update(value).digest("base64");
}
export function paywayRequestTime(now = new Date()) {
  return now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

export function purchaseFields(config: PayWayConfig, payment: { id: string; amountCents: number; currency: string; bookingId: string }) {
  if (payment.currency !== "USD" || !Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) throw new Error("Unsupported payment amount or currency");
  const fields: Record<string, string> = {
    req_time: paywayRequestTime(), merchant_id: config.merchantId, tran_id: payment.id,
    amount: (payment.amountCents / 100).toFixed(2), currency: payment.currency,
    type: "purchase", payment_option: "abapay_khqr_deeplink", view_type: "hosted_view",
    return_url: Buffer.from(`${config.origin}/api/payments/payway/callback`).toString("base64"),
    cancel_url: `${config.origin}/account?payment=cancelled`,
    continue_success_url: `${config.origin}/account?payment=return&booking=${encodeURIComponent(payment.bookingId)}`,
    lifetime: "15", skip_success_page: "1",
  };
  const order = ["req_time", "merchant_id", "tran_id", "amount", "items", "shipping", "firstname", "lastname", "email", "phone", "type", "payment_option", "return_url", "cancel_url", "continue_success_url", "return_deeplink", "currency", "custom_fields", "return_params", "payout", "lifetime", "additional_params", "google_pay_token", "skip_success_page"];
  fields.hash = paywayHash(order.map((key) => fields[key] ?? "").join(""), config.apiKey);
  return fields;
}

const callbackSchema = z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean(), z.null()]));
export function validPaywayCallback(body: unknown, signature: string, apiKey: string) {
  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success || !signature || Object.keys(parsed.data).length > 60) return false;
  const data = Object.keys(parsed.data).sort().map((key) => {
    const value = parsed.data[key];
    return value === null || value === false ? "" : value === true ? "1" : String(value);
  }).join("");
  const expected = Buffer.from(paywayHash(data, apiKey), "base64");
  const received = Buffer.from(signature, "base64");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function trustedCheckoutUrl(value: string, config: PayWayConfig) {
  const url = new URL(value);
  const allowed = config.sandbox ? ["checkout-sandbox.payway.com.kh", "checkout-uat.payway.com.kh"] : ["checkout.payway.com.kh"];
  if (url.protocol !== "https:" || url.username || url.password || url.port || !allowed.includes(url.hostname)) throw new Error("Untrusted checkout URL");
  return url.href;
}

const verificationSchema = z.object({
  status: z.object({ code: z.literal("00"), tran_id: z.string() }),
  data: z.object({ payment_status_code: z.number().int(), payment_status: z.string(), original_amount: z.number().finite().nonnegative(), payment_amount: z.number().finite().nonnegative(), payment_currency: z.string(), refund_amount: z.number().finite().nonnegative() }),
});
export function approvedPaywayPayment(body: unknown, payment: { id: string; amountCents: number; currency: string }) {
  const result = verificationSchema.safeParse(body);
  if (!result.success) return false;
  const { status, data } = result.data;
  return status.tran_id === payment.id && data.payment_status_code === 0 && data.payment_status === "APPROVED" && data.refund_amount === 0 && data.payment_currency === payment.currency && Math.abs(data.original_amount * 100 - payment.amountCents) < 0.000001 && Math.abs(data.payment_amount * 100 - payment.amountCents) < 0.000001;
}

export async function checkPaywayPayment(config: PayWayConfig, payment: { id: string; amountCents: number; currency: string }) {
  const req_time = paywayRequestTime();
  const response = await fetch(`${config.baseUrl}/api/payment-gateway/v1/payments/check-transaction-2`, {
    method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ req_time, merchant_id: config.merchantId, tran_id: payment.id, hash: paywayHash(req_time + config.merchantId + payment.id, config.apiKey) }),
  });
  if (!response.ok) throw new Error("Payment verification unavailable");
  return approvedPaywayPayment(await response.json(), payment);
}