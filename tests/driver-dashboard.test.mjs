import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoCourses, filterDriverCourses, driverSummary, driverDay, navigationUrl, driverNextStatus } from '../lib/driver-dashboard.ts';

const now = new Date('2026-10-20T02:00:00Z');
const courses = createDemoCourses({ id: 'current-driver', name: 'Current Driver' }, now);

test('demo trips belong to the current driver and remain identifiable as fictional', () => {
  assert.equal(courses.length, 5);
  assert.ok(courses.every(course => course.id.startsWith('demo-current-driver-') && course.reference.startsWith('DEMO-') && course.driver.user.name === 'Current Driver'));
  assert.equal(new Set(courses.map(course => course.id)).size, 5);
  assert.equal(courses.filter(course => driverNextStatus[course.status]).length, 4);
  assert.ok(courses.filter(course => driverNextStatus[course.status]).every(course => Date.parse(course.pickupAt) > now.getTime()));
});

test('planning uses Cambodia dates, separates history and searches passenger / flight', () => {
  assert.equal(driverDay('2026-10-20T18:00:00Z'), '2026-10-21');
  assert.equal(filterDriverCourses(courses, 'today', '', now).length, 3);
  assert.equal(filterDriverCourses(courses, 'upcoming', '', now).length, 4);
  assert.equal(filterDriverCourses(courses, 'history', '', now).length, 1);
  assert.equal(filterDriverCourses(courses, 'today', ' k6 104 ', now)[0].customer.name, 'Camille Martin');
  assert.equal(filterDriverCourses(courses, 'upcoming', 'alex', now).length, 1);
});

test('summary excludes cancelled trips from fares and does not combine currencies', () => {
  const result = driverSummary([...courses,
    { ...courses[0], id: 'cancelled', status: 'CANCELLED', priceCents: 99999 },
    { ...courses[0], id: 'eur', currency: 'EUR', priceCents: 2000 },
  ], now);
  assert.deepEqual(result, { remaining: 4, completed: 1, passengers: 11, totals: { USD: 15500, EUR: 2000 } });
});

test('navigation encodes addresses rather than treating them as URL parameters', () => {
  const url = new URL(navigationUrl({ fromAddress: 'Hotel & Spa', toAddress: 'SAI #1' }));
  assert.equal(url.searchParams.get('origin'), 'Hotel & Spa');
  assert.equal(url.searchParams.get('destination'), 'SAI #1');
});