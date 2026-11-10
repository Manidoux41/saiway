import test from "node:test";
import assert from "node:assert/strict";
import { bookingHistoryNote } from "../components/i18n/booking-history-note.ts";
import { interfaceCopy } from "../components/i18n/interface-copy.ts";

for (const language of ["en", "fr", "km"]) {
  test(`guest assignment and optional-reason price history are localized in ${language}`, () => {
    const t = key => {
      assert.equal(typeof interfaceCopy[language][key], "string", `Missing translation ${key}`);
      return interfaceCopy[language][key];
    };
    const money = cents => `${cents / 100} USD`;
    assert.equal(bookingHistoryNote("GUEST FIFO automatic assignment and acceptance; GPS meter starts when passenger boards", t, money), t("ui.noteGuestAccepted"));
    assert.equal(bookingHistoryNote("GUEST no compatible free driver; administrator assignment required", t, money), t("ui.noteGuestWaiting"));
    const note = bookingHistoryNote("DRIVER PRICE_ADJUSTMENT 375 -> 725 USD cents", t, money);
    assert.ok(note.includes(t("ui.notePriceAdjusted")));
    assert.ok(note.includes(t("ui.noteDriver")));
    assert.ok(note.includes("3.75 USD") && note.includes("7.25 USD"));
    assert.ok(!note.includes("undefined") && !note.includes("PRICE_ADJUSTMENT"));
    assert.ok(bookingHistoryNote("PRICE_ADJUSTMENT 375 -> 725 USD cents: Existing admin reason", t, money).endsWith("Existing admin reason"));
  });
}
