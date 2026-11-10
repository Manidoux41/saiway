import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { bookingResultSchema, bookingsSchema, guestRideSchema, locationAccessSchema, quoteSchema, walkupQuoteSchema } from '../src/lib/contracts.ts';

const fare = {
  mode: 'CITY', distanceMeters: 1200, distanceSource: 'ROUTE', circuit: null,
  bookedHours: 8, extraHours: 0, finalized: false, supplements: [{ label: 'Nuit', cents: 100 }],
  policy: { cityMinimumCents: 375 },
};
const course = {
  id: 'booking', reference: 'SW-TEST', fromAddress: 'Hotel', toAddress: 'Market',
  pickupAt: '2026-12-11T14:00:00Z', passengers: 2, luggageCount: 1,
  direction: 'AIRPORT_TO_CITY', tripType: 'CITY_TRANSFER', priceCents: 375, currency: 'USD',
  status: 'DRIVER_ASSIGNED', driverId: 'driver', vehicleId: 'vehicle',
  flightNumber: null, pickupNotes: null, specialNeeds: null, customer: null,
  driver: { id: 'driver', user: { name: 'Driver' } },
  vehicle: { id: 'vehicle', name: 'Sedan', plate: 'TEST', seats: 4 },
  fareDetails: fare, payments: [],
};
test('customer booking -> driver transition -> confirmed receipt keep API response shape', () => {
  assert.equal(quoteSchema.parse({ priceCents: 375, currency: 'USD', fareDetails: fare }).fareDetails.supplements[0].cents, 100);
  const created = bookingResultSchema.parse({ booking: course });
  const updated = bookingResultSchema.parse({ booking: { ...created.booking, status: 'TRIP_COMPLETED' } });
  const collected = bookingsSchema.parse({ bookings: [{ ...updated.booking, payments: [{ status: 'PAID', provider: 'DRIVER_DIRECT', amountCents: 375, currency: 'USD', collectionMethod: 'CASH' }] }] });
  assert.equal(collected.bookings[0].customer, null);
  assert.equal(collected.bookings[0].payments[0].status, 'PAID');
  assert.throws(() => bookingsSchema.parse({ bookings: [{ ...course, priceCents: '375' }] }));
});
test('autonomous outside-zone quotes preserve null price and signed token', () => {
  const result = walkupQuoteSchema.parse({
    token: 'server.signed', expiresAt: Date.now() + 600000, priceCents: null, fareDetails: { ...fare, mode: 'OUTSIDE' },
    route: { from: { latitude: 13.36, longitude: 103.85 }, to: { latitude: 13.4, longitude: 104.1 },
      coordinates: [[103.85, 13.36], [104.1, 13.4]], distanceMeters: 12000, durationSeconds: 1000 },
  });
  assert.equal(result.priceCents, null);
  assert.equal(result.token, 'server.signed');
});
test('guest meter and driver access support unknown destination and nullable GPS', () => {
  const initial = guestRideSchema.parse({ booking: {
    reference: 'SW-GUEST', status: 'DRIVER_ASSIGNMENT_PENDING', fromAddress: 'GPS: 13.36, 103.85',
    toAddress: null, priceCents: null, currency: 'USD', driverName: null, vehicle: null, location: null,
  } });
  assert.equal(initial.booking.toAddress, null);
  const access = locationAccessSchema.parse({ enabled: true, returningToHub: false, booking: null, location: null, hubs: [] });
  assert.equal(access.enabled, true);
});
