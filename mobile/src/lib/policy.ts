import type { Booking } from './contracts';

export const closedStatuses = ['TRIP_COMPLETED', 'CANCELLED', 'NO_SHOW', 'REFUNDED'];
export const trackingStatuses = ['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED'];
export const nextStatus: Record<string, string> = {
  DRIVER_ASSIGNED: 'DRIVER_ACCEPTED', DRIVER_ACCEPTED: 'DRIVER_EN_ROUTE',
  DRIVER_EN_ROUTE: 'DRIVER_ARRIVED', DRIVER_ARRIVED: 'TRIP_STARTED', TRIP_STARTED: 'TRIP_COMPLETED',
};
export const paid = (booking: Booking) => Boolean(booking.payments?.some(payment => payment.status === 'PAID'));
export const paymentLocked = (booking: Booking) => Boolean(booking.payments?.some(payment => ['PAID', 'PROCESSING'].includes(payment.status)));
export const canCancel = (booking: Booking) => ['PENDING_PAYMENT', 'CONFIRMED', 'DRIVER_ASSIGNMENT_PENDING', 'DRIVER_ASSIGNED'].includes(booking.status);
export const canPayOnline = (booking: Booking, now = Date.now()) =>
  !closedStatuses.includes(booking.status) && booking.status !== 'TRIP_STARTED' &&
  !booking.metered && booking.tripType !== 'TOURIST_TOUR' && Date.parse(booking.pickupAt) > now && !paid(booking);

export function trustedCheckout(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
    !['checkout.payway.com.kh', 'checkout-sandbox.payway.com.kh', 'checkout-uat.payway.com.kh'].includes(url.hostname)) {
    throw new Error('Adresse de paiement non autorisee.');
  }
  return url.href;
}

export function pickupIso(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Date ou heure invalide.');
  const value = new Date(`${date}T${time}:00+07:00`);
  const local = new Date(value.getTime() + 7 * 3600000).toISOString();
  if (local.slice(0, 10) !== date || local.slice(11, 16) !== time) throw new Error('Date ou heure invalide.');
  if (value.getTime() <= Date.now()) throw new Error('Choisissez une prise en charge dans le futur.');
  return value.toISOString();
}

export function integer(value: string, min: number, max: number, label: string) {
  const number = Number(value);
  if (!value.trim() || !Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} : valeur entiere entre ${min} et ${max}.`);
  }
  return number;
}

export function cents(value: string) {
  if (!/^\d+([.,]\d{1,2})?$/.test(value.trim())) throw new Error('Montant invalide (deux decimales maximum).');
  const result = Math.round(Number(value.replace(',', '.')) * 100);
  if (!Number.isSafeInteger(result) || result > 10000000) throw new Error('Montant trop eleve.');
  return result;
}

export function visibleBookings(bookings: Booking[], filter: string, query: string, now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' });
  return bookings.filter(booking => {
    const closed = closedStatuses.includes(booking.status);
    const matches = filter === 'all' || (filter === 'history' ? closed : filter === 'payment' ?
      !['CANCELLED', 'NO_SHOW', 'REFUNDED'].includes(booking.status) && !paid(booking) :
      filter === 'today' ? !closed && day.format(new Date(booking.pickupAt)) === day.format(now) : !closed);
    return matches && [booking.reference, booking.fromAddress, booking.toAddress, booking.passengerName,
      booking.customer?.name, booking.professionalCompany].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }).sort((a, b) => Number(closedStatuses.includes(a.status)) - Number(closedStatuses.includes(b.status)) ||
    (closedStatuses.includes(a.status) ? Date.parse(b.pickupAt) - Date.parse(a.pickupAt) : Date.parse(a.pickupAt) - Date.parse(b.pickupAt)));
}
