import { assert, request } from './helpers.mjs';

export function professionalInput(ctx, suffix = 'hotel') {
  return {
    companyName: `${ctx.prefix} hotel`, category: 'HOTEL', address: 'Validation road, Siem Reap',
    contactName: 'Validation receptionist', contactPhone: '+855 12 345 678',
    email: `${ctx.prefix}-${suffix}@example.invalid`, password: ctx.password,
  };
}
export async function registerProfessional(ctx, suffix) {
  const input = professionalInput(ctx, suffix);
  const response = await request('/api/professionals', 'POST', input);
  assert.equal(response.status, 201);
  assert.ok(response.cookie);
  const own = await request('/api/professionals', 'GET', undefined, response.cookie);
  assert.equal(own.status, 200);
  return { input, cookie: response.cookie, profile: own.data.professional };
}
export function reviewInput(profile, overrides = {}) {
  const { companyName, category, address, contactName, contactPhone, status, updatedAt } = profile;
  return { companyName, category, address, contactName, contactPhone, status, updatedAt, ...overrides };
}
export async function approveProfessional(ctx, professional) {
  const response = await request(`/api/admin/professionals/${professional.profile.id}`, 'PATCH', reviewInput(professional.profile, { status: 'APPROVED' }), ctx.cookie);
  assert.equal(response.status, 200);
  professional.profile = response.data.professional;
  return professional;
}
export const professionalBooking = () => ({
  fromAddress: 'SAI Airport', toAddress: 'Validation hotel', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
  pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2, luggageCount: 1,
  passengerName: 'Validation traveller', contactPhone: '', paymentMethod: 'DRIVER',
});
export const professionalQuote = '/api/bookings/quote?direction=AIRPORT_TO_CITY&tripType=AIRPORT_TRANSFER&fromAddress=SAI%20Airport&toAddress=Validation%20hotel';
