import type { TranslationKey } from "@/components/i18n/language-provider";

const errors: Record<string, TranslationKey> = {
  "PRO_APPROVAL_REQUIRED": "pro.blockedHelp",
  "PRO_PASSENGER_REQUIRED": "pro.guest",
  "Cancel the ongoing trip before archiving": "archive.ongoing",
  "Restore the archived booking before editing": "archive.edit",
  "Invalid trip quote; calculate a new route": "ui.quoteExpired",
  "Trip quote expired; calculate a new route": "ui.quoteExpired",
  "Vehicle category changed; calculate a new quote": "ui.quoteExpired",
  "Vehicle already in use": "ui.vehicleBusy",
  "Finish the current trip first": "ui.finishTrip",
  "Driver or vehicle already reserved for this time": "ui.scheduleConflict",
  "Select an active vehicle": "ui.capacity",
  "Select an active vehicle with enough seats": "ui.capacity",
  "Invalid vehicle capacity": "ui.capacity",
  "Driver must be available": "ui.driverAvailable",
  "Select an active, available driver": "ui.driverAvailable",
  "Select an existing active customer": "ui.customerRequired",
  "Select an active customer": "ui.customerRequired",
  "Outside-zone trips require an agreed price and reason": "ui.outsideAgreement",
  "Airport transfers cannot exceed USD 30": "ui.airportLimit",
  "A closed booking cannot be modified": "ui.closedTrip",
  "A paid or processing fare cannot be changed": "ui.paidFare",
  "Payment already started; administrator review required": "ui.paidFare",
  "Pickup must be in the future": "ui.futurePickup",
  "Booking service unavailable": "admin.serverUnavailable",
};

export function bookingErrorKey(message: string | undefined, fallback: TranslationKey): TranslationKey {
  return message && errors[message] ? errors[message] : fallback;
}
