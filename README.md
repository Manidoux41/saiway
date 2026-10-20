This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database and administration

Saiway uses PostgreSQL through Prisma. Configure `DATABASE_URL` for migrations and
`PRISMA_DATABASE_URL` (or `DATABASE_URL` as a fallback) for the application; both
must point to the same database. Set `AUTH_SECRET` to a private, strong value.
Never commit database credentials or account passwords.

Sign in at `/auth` with an existing administrator account to access `/admin`.
Public registration only creates customer accounts; there is no default working
administrator password.

### Separate access areas

| Role | Dashboard | Permitted operations |
|------|-----------|----------------------|
| Administrator | `/admin` | Create customer/driver/admin accounts; manage fleet, fares, contracts, financial records and homepage image; create, edit, assign and cancel trips |
| Driver | `/driver` | Read only assigned trips and advance them through the authorized trip stages |
| Customer | `/account` | Manage personal details; reserve at `/booking`; read only personal bookings; cancel before the driver accepts |

Roles come from the database and cannot be changed through account editing.
Every protected API verifies the signed cookie **and** the current active database
account. Wrong-role page requests redirect to that role's own dashboard. Public
registration creates customers only. Sign out before switching accounts.
Suspension or a changed database role invalidates an existing session immediately.
Browser storage cannot grant permissions. Booking buttons and links are hidden
for administrators and drivers, including on the help page.

### Persistent operations and history

Administrators and drivers can use **Change my password** on their own dashboard.
`POST /api/account/password` requires an active staff session, the current password,
a different new password (8–128 characters) and matching confirmation. Only the
authenticated account is updated; account IDs and roles cannot be supplied.
The new password uses the same salted scrypt format as login and account creation.
The update and password-free audit entry are transactional; concurrent stale
changes are rejected. Existing sessions remain valid, but the old password no
longer works for subsequent sign-ins. Deploy these files to enable this feature on
Vercel; writes then use the database configured for that deployment.

Customer reservations are written to PostgreSQL and receive a unique reference.
The server supplies the displayed quote and calculates the booking price from the
latest effective, active matching fare; without a matching fare, it uses USD 35.
The price is recalculated on submission if a published fare has changed.
Administrators can set an unpaid trip price, assign an active/available driver and an active
vehicle with sufficient seats. Editing the same assignment preserves trip progress;
an ongoing trip cannot be reassigned. Assignment requires a recorded successful
payment; paid and processing fares cannot be changed.

Drivers advance only their own trips through:
`DRIVER_ASSIGNED -> DRIVER_ACCEPTED -> DRIVER_EN_ROUTE -> DRIVER_ARRIVED -> TRIP_STARTED -> TRIP_COMPLETED`.
Invalid/skipped transitions, foreign bookings and concurrent stale updates are rejected.
Trip changes retain status history and audit records. Assignment does not confirm payment.

### Administrator dispatch and shared data

`/admin` opens on the operational dispatch view, with database-backed counters,
search, pickup-date and driver filters, trip maps, and driver workloads. Accounts,
fleet/financial management and password security have separate sections.

Administrators can create unpaid requests and edit paid trips, validate an unassigned future pending paid
trip using `PATCH /api/admin/bookings` with `{ id, status: "CONFIRMED" }`, assign
an active/available driver and a suitable active vehicle, or cancel an open trip.
Validation is operational only: it does not create or mark a payment as paid,
and cannot bypass the payment requirement.
Confirming an already validated, assigned, ongoing or closed trip is rejected.
Confirmation, assignment and driver progress retain database history and audits.

Admin and driver views read the same PostgreSQL bookings through role-scoped APIs.
Both refresh every 15 seconds while the document is visible, and on focus/return.
Polling pauses during mutations; failures are shown without replacing data with
invented records. Driver updates appear in admin, and admin assignments appear
in the assigned driver's schedule. Demo driver trips remain page-local and never
contribute to admin counts. New/edit pickup inputs explicitly use Cambodia time,
independently of the administrator's browser timezone.

### Customer accounts and ABA PayWay / KHQR

Public registration at `/auth` requires only name, email and an 8-128 character
password. The server always creates a CUSTOMER, signs the session and redirects
to `/account`. The customer dashboard contains only that customer's requests,
upcoming trips, payment actions, history and personal profile. `/booking` saves
a PENDING_PAYMENT request with its server-calculated fare and Cambodia pickup
time, then links to payment in the customer dashboard.

The admin dispatch GET lists only bookings with a PAID transaction. The driver
API lists only paid bookings assigned to that driver. No old booking is assumed
paid merely because it is confirmed or assigned. Existing unpaid bookings remain
in the database but are excluded from dispatch until payment is recorded.

PayWay checkout is prepared server-side with HMAC-SHA512 using the stored USD
amount, a 15-minute lifetime and an allowed PayWay hosted KHQR URL. The callback
signature is checked, then the server independently calls Check Transaction.
Only APPROVED (not PRE-AUTH), matching amount/currency/reference and no refund
can record PAID and confirm the booking in one transaction. Repeated callbacks
are idempotent. Late, cancelled or duplicate payments receive a review audit;
cancellation does not automatically refund money. Sandbox payments are labelled
by provider and must use a separate test database/deployment from live payments.

Configure these **server-only** environment variables in your deployment:

```dotenv
PAYWAY_ENVIRONMENT=sandbox
PAYWAY_MERCHANT_ID=your-merchant-id
PAYWAY_API_KEY=your-private-api-key
PAYWAY_PUBLIC_URL=https://your-authorized-domain.example
```

Use a public HTTPS origin, whitelist it with ABA, enable the KHQR checkout option
on the merchant account, and register `/api/payments/payway/callback` as the
callback. Run `npx prisma migrate deploy` on each deployment database before
using checkout. Use `production` with production merchant credentials only
after an ABA sandbox acceptance test. Never prefix these secrets with NEXT_PUBLIC.
Missing configuration returns PAYWAY_NOT_CONFIGURED; no simulated success or
real charge is claimed. No live payment was tested without merchant credentials.
Checkout/verify APIs require the authenticated booking owner, not a supplied
amount or customer ID. Automatic refunds and reconciliation of later refunds
made directly in the merchant portal are not implemented.

Official integration references: [Checkout](https://developer.payway.com.kh/folder-3158159),
[Purchase](https://developer.payway.com.kh/purchase-14530820e0.md),
[Check Transaction](https://developer.payway.com.kh/check-transaction-14530826e0.md).
Run the isolated signing/amount checks with `node --test tests/payway.test.mjs`.

The supplied static ABA QR image is displayed unchanged on future unpaid USD
bookings, with the exact fare, a copyable booking reference, original-image link
and download. Customers can scan it or import the downloaded image into their
banking app. This is a direct bank transfer, not a PayWay transaction: displaying,
downloading or scanning it never marks a booking PAID or releases it to dispatch.
The static transfer needs independent bank verification; no manual confirmation
workflow is implemented by this image integration. Keep the receipt. PayWay
checkout remains a separate option requiring merchant configuration.

### Driver dashboard and trip maps

`/driver` includes daily trip/passenger totals, booking values by currency, a
searchable schedule, status filters, history, passenger and vehicle details,
and the authorized trip-stage controls. Dates use `Asia/Phnom_Penh` (UTC+7).
Booking values are not driver earnings or confirmation of payment.

The **Demo trips** view provides five fictional trips for the signed-in driver,
including four scheduled transfers and one completed transfer. It opens by
default only after a successful empty booking response. Demo updates are local
to the page, reset on reload, and never create bookings or call the update API.
The **Assigned trips** view always uses the existing authenticated driver API.

Leaflet displays OpenStreetMap tiles, Photon locates real addresses in the
Siem Reap region, and OSRM estimates road routes. External services receive
addresses/coordinates, not passenger names or account details. Routing failures
show only located endpoints, not a fabricated road route. Navigation can also
be opened in Google Maps. These public services require a network connection,
have no availability guarantee, and should be replaced with contracted or
self-hosted services for production volume. This is not live GPS or traffic.

Run the isolated dashboard checks with Node.js 22.18+ using
`node --test tests/driver-dashboard.test.mjs` (no database required).

Accounts, vehicles, fares and contracts are deactivated rather than deleted.
Trips are cancelled, not removed. Financial history cannot be deleted through the
management API. Use **Edit records and settings** to edit existing records or
create fares/contracts; account roles remain immutable, and administrators cannot
suspend themselves. Driver availability and license details are editable.
Homepage image settings are now shared through the database.

ABA PayWay payment processing requires the merchant configuration above.
Shared live GPS and driver messaging are not connected.
The tracking screen shows real trip statuses, not a simulated driver map.
Static marketing content is not a general-purpose CMS.
The service worker caches only local icons and the manifest, never APIs, pages or
authenticated navigation/RSC payloads; protected areas require a server connection.

### Integration checks

With the application running (`npm run dev`) and database variables configured,
run `npm test`. The tests exercise driver creation and login, customer profiles,
fleet, accounting and forecasts against the real application and database.
They also exercise the role/page/API access matrix, booking ownership, dispatch,
driver progression, concurrent updates, fare/contract editing and archival history.
They create uniquely named test accounts and records, then remove them in cleanup.
Prefer a dedicated test database and run the application against that same database.
Integration files run sequentially to limit simultaneous remote database connections;
the concurrency-conflict test still submits simultaneous updates within its journey.
Set `VALIDATION_URL` to test a local server on a different port.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
