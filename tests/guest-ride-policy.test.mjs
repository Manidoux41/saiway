import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
const require = createRequire(import.meta.url);
const compiled = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL("../lib/guest-ride-policy.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "module", "exports", code)(require, compiled, compiled.exports);
const { guestGpsSchema, freshGuestGps, guestRideViewSchema, guestCancellableStatuses } = compiled.exports;
test("GPS-only requests validate accuracy, world bounds, timestamps and reject extra contact/account fields", () => {
  const gps = { latitude: 13.36, longitude: 103.85, accuracy: 10, capturedAt: new Date().toISOString() };
  assert.deepEqual(guestGpsSchema.parse(gps), gps);
  for (const change of [{ latitude: 91 }, { latitude: NaN }, { longitude: 181 }, { accuracy: -1 }, { accuracy: 101 }, { accuracy: Infinity }, { capturedAt: "invalid" }, { name: "test" }, { customerId: "test" }]) {
    assert.equal(guestGpsSchema.safeParse({ ...gps, ...change }).success, false);
  }
  const now = Date.now();
  for (const age of [0, 120000, -10000]) assert.equal(freshGuestGps(new Date(now - age).toISOString(), now), true);
  for (const age of [120001, -10001]) assert.equal(freshGuestGps(new Date(now - age).toISOString(), now), false);
  assert.equal(guestCancellableStatuses.includes("TRIP_STARTED"), false);
});
test("private passenger view distinguishes unknown fare from zero and excludes internal identifiers and contact data", () => {
  const value = guestRideViewSchema.parse({ reference: "SW-TEST", status: "DRIVER_ASSIGNED", fromAddress: "GPS: 13.36, 103.85", toAddress: null, priceCents: null, currency: "USD", driverName: "Driver", vehicle: { name: "Car", plate: "TEST" }, location: null, tokenHash: "secret", customer: { email: "private" }, driverId: "private" });
  assert.equal(value.priceCents, null);
  assert.equal(value.toAddress, null);
  for (const key of ["tokenHash", "customer", "driverId"]) assert.equal(key in value, false);
});
