/* Used only by an explicitly isolated validation server, never by normal startup. */
import fs from "node:fs";
import webpush from "web-push";
const database = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(database.hostname) || !database.pathname.includes("validation") || !process.env.PUSH_VALIDATION_LOG) {
  throw new Error("Push transport fixture requires an isolated local validation database and log");
}
const attempts = new Map();
webpush.sendNotification = async (subscription, payload, options) => {
  const count = (attempts.get(subscription.endpoint) || 0) + 1;
  attempts.set(subscription.endpoint, count);
  fs.appendFileSync(process.env.PUSH_VALIDATION_LOG, `${JSON.stringify({ endpoint: subscription.endpoint, payload: JSON.parse(payload), attempt: count, urgency: options.urgency, ttl: options.TTL })}\n`, { mode: 0o600 });
  if (subscription.endpoint.endsWith("/gone")) throw new webpush.WebPushError("Expired", 410, {}, "", subscription.endpoint);
  if (subscription.endpoint.endsWith("/retry") && count === 1) throw new webpush.WebPushError("Temporary failure", 503, {}, "", subscription.endpoint);
  return { statusCode: 201, body: "", headers: {} };
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin === "https://exp.host" && url.pathname === "/--/api/v2/push/send") {
    const payload = JSON.parse(options.body);
    const count = (attempts.get(payload.to) || 0) + 1;
    attempts.set(payload.to, count);
    fs.appendFileSync(process.env.PUSH_VALIDATION_LOG, `${JSON.stringify({ channel: "EXPO", endpoint: payload.to, payload, attempt: count })}\n`, { mode: 0o600 });
    if (payload.to.includes("_gone]")) return Response.json({ data: { status: "error", details: { error: "DeviceNotRegistered" } } });
    if (payload.to.includes("_retry]") && count === 1) return new Response("", { status: 503 });
    return Response.json({ data: { status: "ok", id: `ticket:${payload.to}` } });
  }
  if (url.origin === "https://exp.host" && url.pathname === "/--/api/v2/push/getReceipts") {
    const { ids } = JSON.parse(options.body);
    const data = Object.fromEntries(ids.map(id => [id, id.includes("_receiptgone]") ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" }]));
    return Response.json({ data });
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("External network is disabled on the push validation server");
  return originalFetch(input, options);
};
