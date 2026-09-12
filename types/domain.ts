export type BookingTripType = "airport-transfer" | "private-transfer" | "hotel-transfer";
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAID"
  | "CONFIRMED"
  | "DRIVER_ASSIGNMENT_PENDING"
  | "DRIVER_ASSIGNED"
  | "DRIVER_ACCEPTED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVED"
  | "TRIP_STARTED"
  | "TRIP_COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "REFUND_PENDING"
  | "REFUNDED";

export interface BookingSummary {
  from: string;
  to: string;
  date: string;
  time: string;
  passengers: number;
  vehicle: string;
  price: number;
}

export interface DriverTripCard {
  time: string;
  route: string;
  passengers: number;
  status: string;
  amount: string;
}

export type DriverMessageReason =
  | "flightDelay"
  | "baggage"
  | "immigration"
  | "other";

export interface DriverMessage {
  bookingReference: string;
  reason: DriverMessageReason;
  message: string;
  sentAt: string;
}
