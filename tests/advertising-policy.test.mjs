import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compiled = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL("../lib/advertising-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "module", "exports", code)(require, compiled, compiled.exports);
const { advertisingInputSchema, advertisingContractSchema, publicAdvertisingSchema } = compiled.exports;
const valid = {
  advertiser: "Agency", contactName: "Bookings", contactEmail: "", contactPhone: "", title: "Siem Reap tours",
  description: "Explore Cambodia", targetUrl: "https://example.com/tours", placements: ["HOME"], status: "DRAFT",
  startsAt: "2026-11-10T09:00:00+07:00", endsAt: "2026-11-20T09:00:00+07:00",
  amountCents: 5000, priority: 1, notes: null, terms: null,
};
test("advertising contracts validate precise dates, amounts, statuses and placements", () => {
  const result = advertisingInputSchema.parse(valid);
  assert.equal(result.contactEmail, null);
  assert.equal(result.amountCents, 5000);
  for (const change of [
    { endsAt: valid.startsAt }, { endsAt: "2026-11-01T00:00:00Z" }, { startsAt: "invalid" },
    { amountCents: -1 }, { amountCents: 1.5 }, { amountCents: 100000001 }, { currency: "KHR" },
    { placements: [] }, { placements: ["HOME", "HOME"] }, { placements: ["ADMIN"] }, { status: "PAID" },
    { advertiser: " " }, { title: " " }, { contactEmail: "not-an-email" }, { priority: 1000 },
  ]) assert.equal(advertisingInputSchema.safeParse({ ...valid, ...change }).success, false, JSON.stringify(change));
});
test("advertising links reject executable, insecure and credential-bearing URLs", () => {
  for (const targetUrl of ["javascript:alert(1)", "data:text/html,test", "http://example.com", "//example.com", "https://user:pass@example.com", "file:///tmp/test", "https://"]) {
    assert.equal(advertisingInputSchema.safeParse({ ...valid, targetUrl }).success, false, targetUrl);
  }
  assert.equal(advertisingInputSchema.safeParse({ ...valid, targetUrl: "https://example.com/path?a=1#booking" }).success, true);
});
test("public advertisement schema excludes private contractual and contact details", () => {
  const ad = publicAdvertisingSchema.parse({ ...valid, id: "test", image: null, endsAt: valid.endsAt, reference: "PRIVATE", contactEmail: "private@example.invalid" });
  assert.deepEqual(Object.keys(ad).sort(), ["advertiser", "description", "endsAt", "id", "image", "targetUrl", "title"]);
});
test("admin contract responses including archival timestamps can be read back by the editor", () => {
  const contract = { ...valid, id: "contract", reference: "AD-2026-12345678", currency: "USD", createdAt: valid.startsAt, updatedAt: valid.startsAt, deletedAt: null, image: null };
  assert.equal(advertisingContractSchema.parse(contract).deletedAt, null);
  assert.equal(advertisingContractSchema.parse({ ...contract, deletedAt: valid.endsAt }).deletedAt, valid.endsAt);
});
