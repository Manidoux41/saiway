import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(), name: z.string(), email: z.string(),
  role: z.enum(['customer', 'driver']),
});
export type User = z.infer<typeof userSchema>;
export const authSchema = z.object({ user: userSchema });
export const pointSchema = z.object({ latitude: z.number(), longitude: z.number() });
export type Point = z.infer<typeof pointSchema>;
export const routeSchema = z.object({
  from: pointSchema, to: pointSchema, distanceMeters: z.number(), durationSeconds: z.number(),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});
export const fareSchema = z.object({
  mode: z.string(), distanceMeters: z.number().nullable(), distanceSource: z.string(),
  circuit: z.string().nullable(), bookedHours: z.number(), extraHours: z.number(),
  guestMeter: z.boolean().optional(), finalized: z.boolean(),
  supplements: z.array(z.object({ label: z.string(), cents: z.number() })).optional(),
}).passthrough();
export const bookingSchema = z.object({
  id: z.string(), reference: z.string(), fromAddress: z.string(), toAddress: z.string(),
  pickupAt: z.string(), passengers: z.number(), luggageCount: z.number(),
  direction: z.string(), tripType: z.string(), priceCents: z.number(), currency: z.string(), status: z.string(),
  driverId: z.string().nullable(), vehicleId: z.string().nullable(),
  flightNumber: z.string().nullable(), pickupNotes: z.string().nullable(), specialNeeds: z.string().nullable(),
  passengerName: z.string().nullable().optional(), contactPhone: z.string().nullable().optional(),
  professionalCompany: z.string().nullable().optional(), professionalPhone: z.string().nullable().optional(),
  metered: z.boolean().optional(), originType: z.string().optional(), pricingStatus: z.string().optional(),
  paymentMethod: z.enum(['UNDECIDED', 'ONLINE', 'DRIVER']).optional(),
  driverObservations: z.string().nullable().optional(),
  fareDetails: fareSchema.nullable().optional(), routeDetails: routeSchema.nullable().optional(),
  customer: z.object({ id: z.string(), name: z.string(), email: z.string(), phone: z.string().nullable().optional() }).nullable(),
  driver: z.object({ id: z.string(), user: z.object({ name: z.string() }) }).nullable(),
  vehicle: z.object({ id: z.string(), name: z.string(), plate: z.string(), seats: z.number() }).nullable(),
  payments: z.array(z.object({
    status: z.string(), provider: z.string(), amountCents: z.number(), currency: z.string(),
    collectionMethod: z.string().nullable().optional(),
  })).optional(),
  statusHistory: z.array(z.object({ status: z.string(), note: z.string().nullable(), createdAt: z.string() })).optional(),
});
export type Booking = z.infer<typeof bookingSchema>;
export const bookingsSchema = z.object({ bookings: z.array(bookingSchema) });
export const bookingResultSchema = z.object({ booking: bookingSchema });
export const vehicleSchema = z.object({ id: z.string(), name: z.string(), plate: z.string(), seats: z.number().optional() });
export const availabilityStateSchema = z.object({
  isAvailable: z.boolean(), availableSince: z.string().nullable(), selectedVehicleId: z.string().nullable(),
});
export const availabilitySchema = z.object({
  driverAvailability: availabilityStateSchema, vehicles: z.array(vehicleSchema),
});
export const locationSchema = pointSchema.extend({
  accuracy: z.number().nullable(), heading: z.number().nullable(), recordedAt: z.string(),
});
export const trackingSchema = z.object({
  tracking: z.boolean(), location: locationSchema.nullable(),
  history: z.array(pointSchema),
});
export const locationAccessSchema = z.object({
  enabled: z.boolean(), returningToHub: z.boolean(),
  booking: z.object({ id: z.string(), status: z.string() }).nullable(),
  location: locationSchema.nullable(),
  hubs: z.array(pointSchema.extend({ id: z.string(), name: z.string(), address: z.string() })),
});
export const profileSchema = z.object({
  name: z.string(), email: z.string(), phone: z.string().nullable(),
  customer: z.object({ address: z.string().nullable() }).nullable(),
});
export const professionalSchema = z.object({
  professional: z.object({
    companyName: z.string(), category: z.string(), address: z.string(),
    contactName: z.string(), contactPhone: z.string(), status: z.string(),
  }).nullable(),
});
export const quoteSchema = z.object({ priceCents: z.number(), currency: z.string(), fareDetails: fareSchema });
export const walkupQuoteSchema = z.object({
  token: z.string(), priceCents: z.number().nullable(), expiresAt: z.number(),
  route: routeSchema, fareDetails: fareSchema,
});
export const paymentSchema = z.object({ paid: z.boolean(), checkoutUrl: z.string().optional(), sandbox: z.boolean().optional() });
export const okSchema = z.object({ ok: z.boolean() });
export const guestRideSchema = z.object({ booking: z.object({
  reference: z.string(), status: z.string(), fromAddress: z.string(), toAddress: z.string().nullable(),
  priceCents: z.number().nullable(), currency: z.string(), driverName: z.string().nullable(),
  vehicle: z.object({ name: z.string(), plate: z.string() }).nullable(),
  location: pointSchema.extend({ recordedAt: z.string() }).nullable(),
}).nullable() });
export const licenseSchema = z.object({ license: z.object({
  id: z.string(), licenseNo: z.string().nullable(), licenseExpiresAt: z.string().nullable(),
  licenseImages: z.array(z.object({ side: z.enum(['FRONT', 'BACK']), uploadedAt: z.string() })),
}) });
export const contactQrSchema = z.object({ driver: z.object({
  id: z.string(), contactQrImages: z.array(z.object({ channel: z.string(), uploadedAt: z.string() })),
}) });
export const expensesSchema = z.object({
  vehicles: z.array(vehicleSchema),
  expenses: z.array(z.object({
    id: z.string(), occurredAt: z.string(), odometerKm: z.string(), liters: z.string().nullable(),
    amountCents: z.number(), currency: z.string(), status: z.string(),
    vehicle: z.object({ name: z.string(), plate: z.string() }),
  })),
});
export const payrollsSchema = z.object({ payrolls: z.array(z.object({
  id: z.string(), month: z.string(), status: z.string(), baseSalaryCents: z.number(),
  eligibleRevenueCents: z.number(), commissionCents: z.number(), bonusCents: z.number(),
  deductionCents: z.number(), netCents: z.number(), currency: z.string(), paidAt: z.string().nullable(),
})) });
