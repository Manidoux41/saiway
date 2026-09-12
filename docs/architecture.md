# SAIWAY architecture

## 1. Architecture overview

SAIWAY is designed as a modular transport platform with a server-first booking flow. The application keeps pricing, booking creation, payment verification, dispatch, and GPS tracking under server control so the browser never decides the authoritative state.

### Core layers

- App shell: Next.js App Router for customer, driver, and admin surfaces
- Domain modules: booking, pricing, payment, dispatch, tracking, users
- Data layer: PostgreSQL + Prisma models for users, bookings, vehicles, pricing, and audit events
- API layer: route handlers for bookings, payment flows, driver actions, and GPS updates
- Real-time layer: serverless-friendly event publishing and polling design for Vercel
- Security layer: Zod validation, RBAC, webhook verification, audit logging, and Vercel secrets

## 2. Project tree

```text
app/
  (public)/
  about/
  admin/
  booking/
  driver/
  api/
components/
  ui/
  booking/
  map/
  driver/
  admin/
  layout/
  branding/
lib/
  auth/
  db/
  mapbox/
  pricing/
  booking/
  dispatch/
  payments/
  tracking/
  notifications/
modules/
  users/
  bookings/
  drivers/
  vehicles/
  pricing/
  dispatch/
  payments/
  tracking/
prisma/
  schema.prisma
  seed.ts
tests/
types/
.env.example
README.md
```

## 3. Dependencies

### App framework

- Next.js 16
- React 19
- TypeScript 5

### Core platform

- PostgreSQL + Prisma ORM
- Mapbox SDK and geocoding helpers
- Zod for server-side validation
- Tailwind CSS for design system

### Future additions by phase

- Auth provider for customer/driver/admin roles
- Payment SDKs for KHQR, Bakong, ABA PayWay, Stripe
- Webhook signer and idempotency helpers
- Realtime provider such as Upstash or Vercel KV plus polling strategy for driver tracking

## 4. Design system

The brand system is intentionally premium but approachable:

- Primary: Deep Emerald #087F5B
- Primary dark: Jungle Green #075E45
- Accent: Warm Gold #F4B942
- Background: Sand #F7F4EC
- Surface: White #FFFFFF
- Text: Charcoal #17221F

### UI principles

- Minimal, mobile-first, reassuring journey
- Strong CTA hierarchy with accessible contrast
- Premium local travel tone without flashy styling
- Large tap targets for mobile booking and driver actions

## 5. Component structure

- `Logo`: shared brand identity for header, footer, and app surfaces
- `Header`: top navigation with primary CTA and mobile menu
- `BookingWidget`: central reservation flow for route, time, passengers, and pricing summary
- `Button`: framework for primary, secondary, and accent actions
- `Card`: reusable shell for content and pricing blocks
- `AdminSummaryCard`: executive overview cards for bookings and live vehicles

## 6. Data model direction

The system is built around server-truth entities such as:

- `User`
- `CustomerProfile`
- `DriverProfile`
- `Vehicle`
- `VehicleType`
- `Booking`
- `BookingStatusHistory`
- `DriverLocation`
- `PricingRule`
- `Payment`
- `PaymentEvent`
- `Notification`
- `SystemSetting`
- `AuditLog`
- `Airport`
- `Address`

## 7. Customer flow

1. Customer lands on homepage and sees the booking widget immediately
2. They choose airport and hotel destination
3. They select itinerary date and time
4. They choose passengers and baggage
5. The server calculates the price using pricing rules
6. They complete customer details and payment
7. Payment confirmation triggers booking confirmation and admin dispatch visibility

## 8. Driver flow

1. Driver receives trip assignment in admin dashboard
2. Driver opens the mobile dashboard and accepts the trip
3. GPS permission is requested only during active trip
4. Location is sent at 5-10 second intervals while the trip is active
5. Driver updates trip state as en route, arrived, started, and completed

## 9. Admin flow

1. Admin reviews daily operations dashboard
2. New bookings appear in the dispatch list
3. Admin assigns a driver and vehicle to a trip
4. Trip status and pricing are visible in real time
5. Tracking and revenue insights are reported from the same operational view

## 10. implementation status

This repository now includes the initial Phase 1 foundation:

- shared SAIWAY brand system
- responsive homepage and booking widget
- admin and driver entry screens
- project structure and environment template
- architecture documentation

The next work stream continues into PostgreSQL and Prisma schema design, followed by booking and payment APIs.
