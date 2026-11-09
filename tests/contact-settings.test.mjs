import test from "node:test";
import assert from "node:assert/strict";
import { contactSettings, contactSettingsSchema, defaultContactEmail } from "../lib/contact-settings.ts";

test("public contact settings normalize email and allow email-only publication", () => {
  assert.deepEqual(contactSettingsSchema.parse({ email: " Contact@Example.invalid ", driverId: null }), { email: "contact@example.invalid", driverId: null });
  assert.equal(contactSettings(undefined), null);
  assert.equal(contactSettings(null), null);
  assert.match(defaultContactEmail, /^[^@]+@[^@]+$/);
});

test("public contact settings reject malformed stored values and unsafe input", () => {
  for (const value of ["", "{", "null", '{"email":"invalid","driverId":null}']) assert.throws(() => contactSettings(value));
  for (const email of ["mailto:contact@example.invalid", "a@example.invalid\r\nBcc:b@example.invalid", "bad"]) assert.equal(contactSettingsSchema.safeParse({ email, driverId: null }).success, false);
  assert.equal(contactSettingsSchema.safeParse({ email: "a@example.invalid", driverId: "" }).success, false);
  assert.equal(contactSettingsSchema.safeParse({ email: "a@example.invalid", driverId: null, publicLicense: true }).success, false);
});
