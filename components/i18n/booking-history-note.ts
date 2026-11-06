import type { interfaceCopy } from "./interface-copy";

type Translate = (key: keyof typeof interfaceCopy.en) => string;

export function bookingHistoryNote(note: string | null, t: Translate, money: (cents: number) => string): string {
  if (!note) return "";
  const fixed = {
    "Driver started autonomous trip; estimate retained": "ui.noteStarted",
    "Booking created; payment is tracked separately": "ui.noteCreated",
    "ADMIN operational confirmation; payment tracked separately": "ui.noteConfirmed",
    "ADMIN update": "ui.noteAdmin", "DRIVER update": "ui.noteDriver", "CUSTOMER update": "ui.noteCustomer",
  } as const;
  if (Object.hasOwn(fixed, note)) return t(fixed[note as keyof typeof fixed]);
  if (note.startsWith("DRIVER_AGREED: ")) return `${t("ui.noteAgreed")}: ${note.slice("DRIVER_AGREED: ".length)}`;
  const adjusted = /^PRICE_ADJUSTMENT (\d+) -> (\d+) USD cents: ([\s\S]*)$/.exec(note);
  if (adjusted) return `${t("ui.notePriceAdjusted")}: ${money(Number(adjusted[1]))} → ${money(Number(adjusted[2]))}; ${adjusted[3]}`;
  const finalized = /^FARE_FINALIZED (\d+) -> (\d+) USD cents; (zero GPS distance; original road estimate retained|driver confirmed road estimate|GPS distance|agreed\/package fare); ([\s\S]*)$/.exec(note);
  if (finalized) {
    const reasons = {
      "zero GPS distance; original road estimate retained": "ui.noteZeroGps",
      "driver confirmed road estimate": "ui.noteEstimateConfirmed",
      "GPS distance": "ui.noteGps", "agreed/package fare": "ui.notePackage",
    } as const;
    return `${t("ui.noteFinalized")}: ${money(Number(finalized[1]))} → ${money(Number(finalized[2]))}; ${t(reasons[finalized[3] as keyof typeof reasons])}${finalized[4] ? `; ${finalized[4]}` : ""}`;
  }
  return note;
}
