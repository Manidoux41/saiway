import fs from "node:fs";
import webpush from "web-push";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const subject = process.argv[2] || process.env.VAPID_SUBJECT;
if (!subject || !/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) {
  throw new Error("Provide a public contact: node scripts/setup-push.mjs mailto:contact@example.com");
}
const file = ".env.local";
const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
for (const name of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) {
  if ([...text.matchAll(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`, "gm"))].length > 1) throw new Error(`Remove duplicate ${name} entries first`);
}
let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;
if (Boolean(publicKey) !== Boolean(privateKey)) throw new Error("Both VAPID keys must be configured together; no existing key was overwritten");
if (!publicKey) ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
webpush.setVapidDetails(subject, publicKey, privateKey);
let updated = text;
for (const [name, value] of Object.entries({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject })) {
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=.*$`, "m");
  updated = pattern.test(updated) ? updated.replace(pattern, line) : `${updated.trimEnd()}\n${line}\n`;
}
fs.writeFileSync(file, updated, { mode: 0o600 });
fs.chmodSync(file, 0o600);
console.log("VAPID configuration saved in ignored .env.local. No private key was printed. Restart SAIWAY.");
