/* Used only by an explicitly isolated validation server, never by normal startup. */
import fs from "node:fs";
import webpush from "web-push";
const database = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(database.hostname) || !database.pathname.includes("validation") || !process.env.PUSH_VALIDATION_LOG) {
  throw new Error("Push transport fixture requires an isolated local validation database and log");
}
const attempts = new Map();
webpush.sendNotification = async (subscription, payload) => {
  const count = (attempts.get(subscription.endpoint) || 0) + 1;
  attempts.set(subscription.endpoint, count);
  fs.appendFileSync(process.env.PUSH_VALIDATION_LOG, `${JSON.stringify({ endpoint: subscription.endpoint, payload: JSON.parse(payload), attempt: count })}\n`, { mode: 0o600 });
  if (subscription.endpoint.endsWith("/gone")) throw new webpush.WebPushError("Expired", 410, {}, "", subscription.endpoint);
  if (subscription.endpoint.endsWith("/retry") && count === 1) throw new webpush.WebPushError("Temporary failure", 503, {}, "", subscription.endpoint);
  return { statusCode: 201, body: "", headers: {} };
};
