import nextEnv from "@next/env";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

nextEnv.loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)));

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Usage: node scripts/check-cron.mjs https://saiway.vercel.app");
  const origin = new URL(args[0]);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new Error("Provide an HTTPS origin (or HTTP localhost), without credentials, path or query.");
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is missing locally. Configure it privately; do not pass it as a CLI argument.");
  const headers = (value) => value ? { Authorization: `Bearer ${value}` } : {};
  const call = (url, options = {}) => fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(25_000) });
  const paths = ["/api/cron/push-notifications", "/api/cron/driver-location-retention"];
  // Older deployments ignore dryRun; verify support before sending any valid credential.
  for (const path of paths) {
    const options = await call(`${origin.origin}${path}`, { method: "OPTIONS" });
    if (options.status !== 204 || options.headers.get("X-Saiway-Cron-Dry-Run") !== "1") {
      throw new Error(`${path}: deploy the version supporting dry-run checks first. No authenticated execution attempted.`);
    }
  }
  for (const path of paths) {
    const url = `${origin.origin}${path}?dryRun=true`;
    for (const value of [undefined, randomBytes(32).toString("hex")]) {
      const response = await call(url, { headers: headers(value) });
      if (![401, 403].includes(response.status)) throw new Error(`${path}: authentication rejection test failed (HTTP ${response.status}).`);
    }
    const response = await call(url, { headers: headers(secret) });
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${path}: HTTP ${response.status}. Check that local CRON_SECRET matches Vercel Production, redeploy, and configure the same Bearer header in cron-job.org.`);
    }
    if (response.status !== 200) throw new Error(`${path}: authenticated check failed (HTTP ${response.status}); inspect server configuration/logs.`);
    const result = await response.json();
    if (path.includes("push-notifications") ? result.dryRun !== true || result.sent !== 0 || result.removed !== 0 :
      result.removed !== 0 || !(result.dryRun === true || result.skipped === true && result.reason === "DISABLED")) {
      throw new Error(`${path}: unexpected dry-run response. No further requests made.`);
    }
    console.log(`${path}: PASS (missing/wrong secret rejected; authenticated dry run HTTP 200; no sends or deletions).`);
  }
}

main().catch((error) => {
  console.error(error instanceof TypeError ? "Cron check failed: network/URL error; verify the origin and deployment access." : error.message);
  process.exitCode = 1;
});
