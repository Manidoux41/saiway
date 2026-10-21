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
an ongoing trip cannot be reassigned. Assignment is possible before payment or
payment-method selection; paid and processing fares cannot be changed.

Drivers advance only their own trips through:
`DRIVER_ASSIGNED -> DRIVER_ACCEPTED -> DRIVER_EN_ROUTE -> DRIVER_ARRIVED -> TRIP_STARTED -> TRIP_COMPLETED`.
Invalid/skipped transitions, foreign bookings and concurrent stale updates are rejected.
Trip changes retain status history and audit records. Assignment does not confirm payment.

### Administrator dispatch and shared data

`/admin` opens on the operational dispatch view, with database-backed counters,
search, pickup-date and driver filters, trip maps, and driver workloads. Accounts,
fleet/financial management and password security have separate sections.

Administrators can create and edit requests, validate an unassigned future pending
trip using `PATCH /api/admin/bookings` with `{ id, status: "CONFIRMED" }`, assign
an active/available driver and a suitable active vehicle, or cancel an open trip.
Validation is operational only: it does not create or mark a payment as paid.
Confirming an already validated, assigned, ongoing or closed trip is rejected.
Confirmation, assignment and driver progress retain database history and audits.

Admin and driver views read the same PostgreSQL bookings through role-scoped APIs.
Both refresh every 15 seconds while the document is visible, and on focus/return.
Polling pauses during mutations; failures are shown without replacing data with
invented records. Driver updates appear in admin, and admin assignments appear
in the assigned driver's schedule. Demo driver trips remain page-local and never
contribute to admin counts. New/edit pickup inputs explicitly use Cambodia time,
independently of the administrator's browser timezone.

Trip-list refreshes wait for an in-flight request instead of aborting it on each
15-second poll or focus event. Requests have a 30-second timeout. Authentication,
temporary service, timeout and invalid-response failures are shown separately;
customers can retry loading without resubmitting a saved reservation.

### Customer accounts and ABA PayWay / KHQR

Public registration at `/auth` requires only name, email and an 8-128 character
password. The server always creates a CUSTOMER, signs the session and redirects
to `/account`. The customer dashboard contains only that customer's requests,
upcoming trips, payment actions, history and personal profile. `/booking` saves
a PENDING_PAYMENT request with its server-calculated fare and Cambodia pickup
time, immediately makes it visible to administrators, then links to payment-method
selection in the customer dashboard. The admin may assign it before the customer
chooses how to pay.

Customer sessions use random opaque tokens stored only as SHA-256 hashes in
`CustomerSession`. They do not expire automatically on the server. The HttpOnly,
SameSite=Lax cookie persists across browser restarts and is renewed on visits,
return to a visible tab, and daily while the app is open (400-day browser maximum).
Clearing browser data or browser privacy policies may still require signing in
again. Explicit logout revokes the current token in the database before clearing
the cookie; replaying that token is rejected. Staff retain their seven-day signed
sessions. Existing signed customer sessions migrate on renewal while still valid.
Suspension and role changes are checked on every protected request.

The admin dispatch GET lists all real reservations, including unpaid requests.
The driver API lists only bookings assigned to that driver, regardless of payment.
Neither operational confirmation nor assignment implies that money was received.

Customers choose ONLINE or DRIVER during the booking review, or later through
`POST /api/bookings/payment-method`. Requests without a choice remain UNDECIDED
for backwards compatibility; the choice never creates a payment.
For DRIVER, the customer pays the assigned driver at the end of the trip. After
TRIP_COMPLETED, only that active assigned driver can submit
`POST /api/driver/payments` with
`{ bookingId, received: true, collectionMethod: "CASH" | "CARD" | "ABA" | "OTHER" }`.
The actual method must be explicitly selected; it is not inferred from the booking choice.
The server uses
the stored fare and currency, creates one PAID/DRIVER_DIRECT transaction and
records the actor, amount and payment ID in a DRIVER_PAYMENT_CONFIRMED audit.
The driver must actually receive the full fare before confirming; completing the
trip does not confirm receipt. Repeated/concurrent confirmations cannot create
multiple receipts. The driver UI opens History after completing a real trip.
Paid or processing online payments block method changes and duplicate collection.
Customers and administrators cannot confirm a driver receipt. This is an audited
driver attestation, not an independently verified bank transaction.

The assigned driver may also declare `{ bookingId, received: false }` after
completion: this adds a `DRIVER_PAYMENT_NOT_RECEIVED` audit without creating a
receipt or any revenue. It cannot reverse an already confirmed receipt.
For manual ONLINE QR transfers, only collectionMethod ABA is accepted, recorded
as PAID/ABA_QR_MANUAL after the driver verifies the full transfer in the bank
account. UNDECIDED bookings can also be collected after completion with an explicit
method. Any PROCESSING online payment blocks manual confirmation.

Administrator financial management includes a read-only receipt ledger derived
from PAID transactions, with reference, actual method, driver, timestamp and amount.
It includes existing receipts, excludes ABA_PAYWAY_SANDBOX and unpaid/processing
transactions, and groups totals by currency. USD receipts are included once in
actual revenue alongside manual revenue entries, not copied into editable entries.
Do not manually re-enter these receipts. Old driver receipts retain their
unspecified method rather than being retroactively labelled cash. The ledger
shows booking status for cancellation/refund review; refunds require a separate
accounting adjustment and never silently erase a receipt.

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

The supplied static ABA QR image is displayed unchanged on future unpaid ONLINE USD
bookings, with the exact fare, a copyable booking reference, original-image link
and download. Customers can scan it or import the downloaded image into their
banking app. This is a direct bank transfer, not a PayWay transaction: displaying,
downloading or scanning it never marks a booking PAID.
The static QR contains bank account data, not a payment URL. Its USD amount must
be entered manually; the image is never rewritten to fabricate a dynamic payment
link. The assigned driver verifies this transfer after the trip, as described
above. Keep the receipt and never pay both the static QR and PayWay for the same
trip. PayWay checkout generates the official exact-amount link and remains a
separate option requiring merchant configuration.

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
self-hosted services for production volume. Route estimates do not include traffic.

Run the isolated dashboard checks with Node.js 22.18+ using
`node --test tests/driver-dashboard.test.mjs` (no database required).

### Live driver tracking

When the driver taps **Depart** (status *Driver en route*), the driver dashboard
starts sharing the phone's GPS position (`navigator.geolocation.watchPosition`,
high accuracy). Sharing continues through *Arrived* and *Trip started* and stops
automatically once the trip is completed, cancelled or marked no-show; the stored
position is then erased. Only the latest point per trip is kept (no route history).
Positions are sent at most every 5 seconds, sooner when the car moves more than
15 m, and re-sent every 15 seconds while stationary. Demo trips never share.

Customers open **Track My Driver** (`/booking/track`, or the button on a trip in
`/account`). The page polls `GET /api/bookings/{id}/location` every 4 seconds while
visible and shows the driver, the customer's own position (if the browser grants
location permission; it never leaves the device), pickup/destination, the distance
between them and the age of the last update, with a warning after one minute
without news. Before departure it explains that tracking starts when the driver leaves.

`PUT /api/driver/bookings/{id}/location` accepts only the assigned active driver
during the three tracking statuses. `GET /api/bookings/{id}/location` is limited to
the owning customer, the assigned driver and administrators; other accounts get 404.

Browser limits: location requires HTTPS (or localhost) and permission on both phones.
The driver page must stay open in the foreground; the screen is kept awake when the
browser supports the Wake Lock API, but a web app cannot share GPS in the background
or once the phone locks. Polling was chosen over WebSockets/SSE so it works on
serverless hosting without long-lived connections.

### Contacting the passenger

The booking form stores the passenger phone in `Booking.contactPhone` (digits,
spaces, `+ ( ) . -`, max 30 characters). Booking APIs return it, with the
customer's profile phone as a fallback, only to the customer, administrators and
the driver assigned to that booking. In a real trip, **Contact passenger** shows:

- a WhatsApp / Telegram choice, remembered in the driver's browser;
- **Call on WhatsApp/Telegram**, which opens `https://wa.me/<number>` or
  `https://t.me/+<number>`. Those apps open the conversation; the driver then
  taps their call button. Telegram works only if the passenger has Telegram and
  their privacy settings allow being found by phone number;
- **Send SMS**, which opens the phone's own SMS app (`sms:`) with a prefilled
  message. The SMS is sent from the driver's phone plan; SAIWAY uses no SMS
  provider and stores no message;
- the number itself as a `tel:` link for a normal phone call.

Numbers entered with a leading `0` are treated as Cambodian (+855); `00` and `+`
prefixes are kept as international numbers. Demo trips have no contact actions.

### Driving licence and employment contract

On `/driver`, **Driving licence** lets the driver upload or replace one front and
one back photo (JPEG, PNG or WebP, 5 MB maximum). The server checks the file
signature rather than trusting its name or MIME type, and stores the image in
PostgreSQL (`DriverLicenseImage`, one row per side, bytes in `BYTEA`). Each upload
is recorded in the audit log.

Photos are served only by `GET /api/drivers/{driverId}/license/{FRONT|BACK}` to
that driver or an administrator, with `Cache-Control: private, no-store`,
`nosniff` and a restrictive CSP. Each administrator view is audited. Other
drivers, customers and anonymous visitors receive 403.

Administrators set the licence number, category and expiry date in the account
profile (see below). The driver sees them read-only. **Fleet & management** lists
every driver with these details, links to both photos, and marks the file
**Ready for contract** when the number, a future expiry date and both photos are
present. Images live in the main database, so include it in backups and remember
that it stores personal identity data.

### Administrator account profiles

In `/admin` → **Accounts**, **Edit profile** on any row opens the full profile
(administrators only; `GET`/`PATCH /api/admin/accounts/{userId}`):

- **Identity and access** for every role: name, email, phone and status. Accounts
  are never erased: **Suspended** archives the account, blocks sign-in, closes
  customer sessions and keeps bookings, payments and contracts. Changing a
  driver's or administrator's email signs them out. Administrators cannot edit
  their own account here.
- **Customer details** not asked at sign-up: address, nationality, preferred
  language, company/hotel/agency and internal notes.
- **Driver details**: date of birth, nationality, ID card/passport number,
  address, emergency contact, licence number/category/expiry, availability and
  internal notes.
- **Driving licence photos**: view, upload/replace or delete each side
  (`PUT`/`DELETE /api/drivers/{driverId}/license/{FRONT|BACK}`, audited).

Every field has a clear (×) button; an empty field is stored as `NULL`.
Each change is audited with the field names only (not the values).

### Employment contracts (PDF)

The driver profile lists permanent employment contracts (CDI). The lifecycle is
**Draft** (editable, deletable) → **Active** (signed, read-only) → **Terminated**
(end date on or after the start date). Activation is refused (409 with a
`missing` list) until the employer details and the driver's date of birth,
nationality, ID number, address, phone, licence number and a valid licence expiry
are filled in. A driver can have only one active contract at a time. Signed
contracts are never deleted.

**Download PDF** (`GET /api/admin/contracts/{contractId}/pdf`, audited) generates
an A4 bilingual English/Khmer contract on the server with `pdfkit`: parties,
position, duration and probation (max 3 months), working hours (max 48 h/week),
salary, leave (min 18 days), licence obligations, termination, optional
additional terms (printed as entered) and signatures. Drafts carry a DRAFT
watermark. Employer details (name, registration number, address, legal
representative and title) are set once under **Employer details for contracts**
in the same section (`GET`/`PUT /api/admin/employer`, stored in `SystemSetting`).

> ⚠️ The contract wording is a template. Have both languages reviewed by a
> Cambodian labour lawyer and a native Khmer speaker before using it. The Khmer
> version is declared to prevail.

Fonts are bundled in `assets/fonts/` (Noto Sans for Latin, Battambang for Khmer,
both under the SIL Open Font License, see the `OFL-*.txt` files) and traced into
the PDF route by `next.config.ts`. Schema changes are in the migration
`20261023010000_admin_profiles_employment_contracts`
(run `npx prisma migrate deploy`).

Accounts, vehicles, fares and contracts are deactivated rather than deleted.
Trips are cancelled, not removed. Financial history cannot be deleted through the
management API. Use **Edit records and settings** to edit existing records or
create fares/contracts; account roles remain immutable, and administrators cannot
suspend themselves. Driver availability and license details are editable.
Use **Edit profile** in the Accounts section for the complete customer and driver files.
Homepage image settings are now shared through the database.

ABA PayWay payment processing requires the merchant configuration above.
In-app driver messaging is not connected (drivers contact passengers through
WhatsApp, Telegram, SMS or phone; see above). Live tracking is described above.
Static marketing content is not a general-purpose CMS.
The service worker caches only local icons and the manifest, never APIs, pages or
authenticated navigation/RSC payloads; protected areas require a server connection.

### Integration checks

With the application running (`npm run dev`) and database variables configured,
run `npm test`. The tests exercise driver creation and login, customer profiles,
fleet, accounting and forecasts against the real application and database.
They also exercise the role/page/API access matrix, booking ownership, dispatch,
driver progression, concurrent updates, fare/contract editing and archival history,
plus driver licence photo storage/access isolation, passenger phone visibility,
administrator profile editing, licence photo management, the employment
contract lifecycle with PDF generation, and live driver location sharing
(permissions, throttling, read isolation and erasure when the trip ends).
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
