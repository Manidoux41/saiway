import { timingSafeEqual } from "node:crypto";

export function authorizedCron(request: Request): boolean {
  const expected = Buffer.from(process.env.CRON_SECRET ?? "");
  const received = Buffer.from(request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "");
  return expected.length > 0 && expected.length === received.length && timingSafeEqual(expected, received);
}

export function cronDryRun(request: Request): boolean | null {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== "dryRun") || params.getAll("dryRun").length > 1) return null;
  const value = params.get("dryRun");
  return value === null || value === "false" ? false : value === "true" ? true : null;
}

export function cronOptions() {
  return new Response(null, { status: 204, headers: {
    Allow: "GET, HEAD, OPTIONS", "Cache-Control": "no-store", "X-Saiway-Cron-Dry-Run": "1",
  } });
}

export function cronHead(request: Request) {
  return new Response(null, { status: authorizedCron(request) ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
