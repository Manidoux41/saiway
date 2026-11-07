import { timingSafeEqual } from "node:crypto";

export function authorizedCron(request: Request): boolean {
  const expected = Buffer.from(process.env.CRON_SECRET ?? "");
  const received = Buffer.from(request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "");
  return expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received);
}
