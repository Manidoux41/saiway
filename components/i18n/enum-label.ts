import type { TranslationKey } from "@/components/i18n/language-provider";

const labels: Record<string, TranslationKey> = {
  ADMIN: "auth.admin", DRIVER: "auth.driver", CUSTOMER: "courses.customer",
  ACTIVE: "ui.ACTIVE", INACTIVE: "ui.INACTIVE", SUSPENDED: "ui.SUSPENDED", INVITED: "ui.INVITED",
  REVENUE: "ui.REVENUE", EXPENSE: "ui.EXPENSE", CREDIT: "ui.CREDIT", PURCHASE: "ui.PURCHASE",
  TRIP: "finance.TRIP", FUEL: "finance.FUEL", MAINTENANCE: "finance.MAINTENANCE", SALARY: "finance.SALARY", OTHER: "finance.OTHER",
  true: "ui.true", false: "ui.false",
  AIRPORT_TO_CITY: "courses.airportToCity", CITY_TO_AIRPORT: "courses.cityToAirport",
  AIRPORT_TRANSFER: "booking.airportTransfer", PRIVATE_TRANSFER: "booking.privateTransfer", HOTEL_TRANSFER: "booking.hotelTransfer",
  CITY_TRANSFER: "fare.city", TOURIST_TOUR: "fare.tour",
  PENDING_PAYMENT: "dispatch.pending", CONFIRMED: "dispatch.confirmed", DRIVER_ASSIGNMENT_PENDING: "dispatch.toAssign",
  DRIVER_ASSIGNED: "courses.assigned", DRIVER_ACCEPTED: "courses.accepted", DRIVER_EN_ROUTE: "courses.enRoute",
  DRIVER_ARRIVED: "courses.arrived", TRIP_STARTED: "courses.started", TRIP_COMPLETED: "courses.completed",
  CANCELLED: "courses.cancelled", NO_SHOW: "driver.noShow", REFUNDED: "driver.refunded",
  DRIVER_DIRECT: "payment.atDriver", ABA_QR_MANUAL: "payment.ABA", ABA_PAYWAY: "payment.ABA",
};

export function enumLabel(value: string, t: (key: TranslationKey) => string) {
  return labels[value] ? t(labels[value]) : value;
}
