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

### Driver business cards and contact QR images

In **Admin → Fleet & management**, business cards reuse the homepage SAIWAY logo
and display the driver's photo, booking phone number and online booking QR code.
Drivers upload, replace or delete their personal WhatsApp and Telegram QR images
under **My WhatsApp & Telegram QR codes** on their driver dashboard. Administrators
can also upload, replace and delete both QR images using the WhatsApp and Telegram
controls directly below each card. Refresh the admin dashboard after driver uploads.
Cards use a locally rendered Angkor Wat illustration and gold accents; no external
background image request is required.

Uploads accept JPEG, PNG or WebP up to 5 MB. Use the complete QR image with its
white border, not a screenshot containing the rest of the app interface, and
verify the contact in WhatsApp/Telegram before uploading. Images are stored in
the database, accessible only to the owning driver and active administrators;
mutations are audited. Deploy schema changes with `npx prisma migrate deploy`.

**Download PDF · 8 cards / A4** generates one A4 page with eight copies of the
selected driver's 85 × 55 mm card (two columns, four rows), including the logo,
background, photo and QR images. **Download all · A4 PDF** exports the drivers'
cards eight per A4 page, continuing onto further pages as needed. SAIWAY,
WhatsApp and Telegram logos identify their respective QR codes below each code,
without covering QR modules or their white borders.
The company header includes its slogan and “Airport transfers & private transport”
service description. QR images measure 14 × 14 mm; white backgrounds and quiet
zones are preserved for scanning.
Driver photos use a centered cover crop inside their circular frame in both the
browser print view and downloaded PDFs, for portrait and landscape uploads.
Downloads are restricted to administrators and audited.
JPEG, PNG and WebP uploads are converted for PDF compatibility; invalid images
produce an explicit error rather than an incomplete PDF.

Cards also print at 85 × 55 mm, eight per A4 page. Use 100% print scale, disable browser
headers/footers and enable background graphics. Printing waits
for photos and contact QR images to load and reports a failure rather than
printing incomplete cards.

Saiway uses PostgreSQL through Prisma. Configure `DATABASE_URL` for migrations and
`PRISMA_DATABASE_URL` (or `DATABASE_URL` as a fallback) for the application; both
must point to the same database. Set `AUTH_SECRET` to a private, strong value.
Never commit database credentials or account passwords.

### Environment configuration

Keep local values in the ignored `.env.local` file and configure production
values in the hosting provider's environment settings. Next.js and the Prisma
CLI use the same environment-file precedence: process environment, environment-
specific local file, `.env.local`, environment-specific file, then `.env`.
`NODE_ENV=test` skips `.env.local`; set `NODE_ENV=development` for Prisma CLI
commands that must also load `.env.development.local`. Shell or hosting-provider
variables take precedence over files. Restart the server after changing values.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection for migrations and application fallback. |
| `PRISMA_DATABASE_URL` | Optional application connection, e.g. a pooled URL for the same database. |
| `AUTH_SECRET` | Private session-signing secret; changing it invalidates existing sessions. |
| `NEXT_PUBLIC_APP_URL` | Public site origin, e.g. `http://localhost:3000` locally; set the actual HTTPS origin in production. |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Map tile template and required provider attribution. |
| `NEXT_PUBLIC_ROUTING_URL`, `NEXT_PUBLIC_GEOCODING_URL` | OSRM-compatible routing root and Photon-compatible geocoding endpoint. |
| `CRON_SECRET` | Private bearer secret for scheduled GPS retention. Configure the same value in the scheduler. |
| `PAYWAY_ENVIRONMENT`, `PAYWAY_MERCHANT_ID`, `PAYWAY_API_KEY`, `PAYWAY_PUBLIC_URL` | Optional PayWay configuration; all four are needed for online checkout. |
| `VALIDATION_URL` | Optional base URL for integration tests; defaults to `http://localhost:3000`. Use an isolated test database. |

`NEXT_PUBLIC_` values are exposed to browsers and embedded at build time:
set the correct values **before** building each deployment, never put secrets
in them, and rebuild after changing them. For production use suitable map
providers and a separate production database and secrets. PayWay requires a
public HTTPS callback origin, including when testing it locally; leave its
credentials empty until configured. `DIRECT_URL`, `POSTGRES_URL`,
`PAYMENT_PROVIDER`, and `EMAIL_API_KEY` may exist in older environment files,
but the current application and Prisma configuration do not read them.

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
The server supplies the displayed quote and recalculates it on submission using
the automatic transport tariff described below. Existing bookings keep their
stored amounts; published legacy `PricingRule` rows no longer set new customer fares.
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

### Automatic transport tariffs

**Admin → Fleet & management → Automatic transport fares** edits the existing
`SystemSetting` key `transportFarePolicy`. Only administrators may change it.
Defaults: airport USD 30 per vehicle in either direction (hard maximum USD 30);
city USD 0.65/km with no starting fee or minimum; Small Circuit USD 35 per vehicle
including 8 continuous hours, the 35 km Small Circuit, waiting, driver meal and
water. Passenger meals are excluded. Grand Circuit is USD 45. Remote circuit
pricing starts unset and requires an administrator to enter an agreed amount.
Extra tourist service is USD 5 per additional started hour beyond 8 hours;
the greater of booked duration and actual service duration is billed.
Circuit extensions use an agreed higher package, not a distance surcharge.
Drivers confirm a package upgrade at completion; remote upgrades require a
price in the booking's tariff snapshot. There is no automatic geographic
inference of temple circuits from GPS alone.

`GET /api/bookings/quote` now requires `fromAddress`, `toAddress`, `direction`
and `tripType`; optional `tourCircuit=SMALL|GRAND|REMOTE` and `tourHours` select a
tour package. `POST /api/bookings` accepts the same optional tour fields.
New `TripType` values are `CITY_TRANSFER` and `TOURIST_TOUR`. Other non-airport
private/hotel transfers use the city rate; an airport-labelled endpoint or
coordinates within 2 km of SAI airport use the airport tariff. Road kilometres
come from the configured OSRM-compatible provider, calculated server-side.
No straight-line or default-price fallback is used if routing fails. Amounts
are rounded to the nearest cent. Reservation creation recalculates the quote.
`Booking.fareDetails` records the policy, distance source, circuit, start time
and finalization state. Changes to the tariff never rewrite existing snapshots.
Manual administrator fare/route changes discard the automatic snapshot, except
metered trips cannot be manually edited while open. Airport price edits and new
airport bookings cannot exceed USD 30; old higher-priced records are preserved.

From the driver's real activity view, **Start an unreserved city trip** uses
`POST /api/driver/bookings` with `customerEmail` (existing active customer),
`vehicleId`, `fromAddress`, `toAddress`, `direction`, `tripType=CITY_TRANSFER` and
`passengers`; no `pickupAt`, driver ID or customer-supplied fare is accepted.
The booking starts at server time with `metered=true`, `TRIP_STARTED` and payment
at driver. An accurate GPS fix under a minute old is required. Driver/vehicle
overlaps are rejected in a serializable transaction. The existing single GPS
stream supplies positions; no second watch is started. Completion calculates
the distance from this driver's recorded trip positions. Samples with missing/
poor accuracy (over 50 m), gaps over 60 seconds, stale start/end or speeds over
160 km/h require an explicit fallback confirmation. Segments below 5 m are
ignored, and movement must exceed the combined reported accuracy since the
last accepted point to reduce stationary jitter without discarding cumulative
slow motion; GPS remains an approximate, non-certified meter.
If incomplete, completion returns `409 GPS_INCOMPLETE_CONFIRM_ROUTE`; retrying
with `confirmEstimatedDistance=true` uses server-computed road distance and
records `CONFIRMED_ROUTE`, explicitly excluding unknown detours.
Tour completion may supply `tourCircuit` to confirm an agreed upgrade.
Final fare and status are saved atomically before the existing driver payment
endpoint collects that amount. Metered trips and tours cannot start online
payment because their final amounts may change. No extra payment API is created.

The additive migration `20261106070000_distance_fares` adds two enum values,
`Booking.metered` (default false) and nullable `Booking.fareDetails` JSON.
It leaves existing bookings unchanged. Apply with `prisma migrate deploy`
after testing against an isolated database. Enum additions do not have a safe
automatic down migration; do not remove them while referenced by bookings.
No new dependencies or environment variables are required.

Fare integration tests use the deterministic provider in
`tests/fixtures/fare-provider.mjs` (5 km / 10 minutes for each requested route).
Start it with `node tests/fixtures/fare-provider.mjs`, then build with
`NEXT_PUBLIC_ROUTING_URL=http://127.0.0.1:4369` and
`NEXT_PUBLIC_GEOCODING_URL=http://127.0.0.1:4369/api`; public Next.js settings are
baked into the build, so overriding them only at `next start` is insufficient.
Start the application on `127.0.0.1:4370` with **both** `DATABASE_URL` and
`PRISMA_DATABASE_URL` pointing to the same isolated migrated PostgreSQL database.
Run `VALIDATION_URL=http://127.0.0.1:4370 npm test` with the same database overrides.
Never use the production database for these tests. Stop the fixtures and rebuild
without test provider overrides before running the application normally.
Pure fare tests run separately with `node --test tests/fare-policy.test.mjs`.

### Customer pickup and place suggestions

At `/booking`, pickup and destination are independently editable. Pickup can use
an address, one permission-based current GPS fix, manually entered latitude and
longitude, or a point selected on the Leaflet map. The client reviews the pickup
before submitting; no GPS request is made automatically and no continuous
customer tracking is started. Share uses the device share sheet or copies the
coordinates and an OpenStreetMap link; sharing does not submit a booking.

Exact locations are stored in the existing `fromAddress` / `toAddress` fields as
`GPS: latitude, longitude` (seven decimal places). The booking API validates this
format and coordinate ranges. All shared maps resolve it directly without
geocoding, and navigation links use plain coordinate pairs. Existing address-only
bookings remain unchanged; no database migration is required.

Address suggestions combine the existing place list, Photon-compatible online
search and the signed-in customer's own recent booking addresses.
`GET /api/bookings/places` returns only that customer's distinct pickup and
destination strings from their latest 100 bookings, with `Cache-Control: no-store`;
other roles and anonymous requests are rejected. Suggestions are keyboard
accessible, debounced and cancellable. Text searches go to
`NEXT_PUBLIC_GEOCODING_URL`, biased toward Siem Reap but not restricted to it.
Free-text entry remains available on provider failure; suggestions do not expand
the service coverage or change the existing fare calculation.

### Open-source fleet mapping and live tracking

The existing Next.js API and Prisma/PostgreSQL models power fleet tracking; this
feature does not add a separate backend. Leaflet renders the maps, OpenStreetMap
provides tiles, OSRM calculates routes, and Photon geocodes addresses. Provider
URLs are centralized in `lib/map-client.ts` so compatible tile, routing, and
geocoding services can be substituted without changing the map components.

The administrator dispatch dashboard includes a persistent fleet map, a driver
and status list, hub markers, selectable vehicle markers, and a full-screen view.
Positions refresh every five seconds. The driver dashboard's GPS button opens a
full-screen map; the driver sends one GPS stream while on duty, which feeds the
admin map and the authorized customer's booking view. Customers can follow only
their own assigned booking; their map refreshes every four seconds and stops
exposing live location when that booking closes. GPS requires browser permission
and an open driver dashboard. The configured browser map/routing providers
receive coordinates and/or addresses; use self-hosted or appropriately
contracted providers when production privacy or capacity requires it.

Map paths use dark gold (`#D6A000`) to the pickup, orange (`#F58220`) during a
trip, and green (`#2E9D50`) for a return to a hub. Vehicle icon categories and
optional JPEG, PNG, or WebP custom icons are managed under **Admin → Fleet &
management**; administrators can preview the selected icon on a map. The same
vehicle marker is used on admin, driver, and customer maps. Hubs are managed in
the same section and are deactivated rather than deleted.

| Endpoint | Access | Purpose |
|----------|--------|---------|
| `GET /api/admin/fleet-locations` | Admin | Active drivers, recent positions, assigned vehicles, routes' targets, and hubs |
| `GET, PUT /api/driver/location` | Driver | Read sharing state/hubs; submit the driver's single GPS stream |
| `GET /api/bookings/{id}/location` | Owning customer/driver or admin | Read an authorized booking's live location and active-trip history |
| `/api/admin/management` | Admin | Create/edit/deactivate hubs and set vehicle icon categories |
| `PUT, DELETE /api/admin/vehicles/{id}/icon` | Admin | Upload or remove a vehicle marker image |
| `GET /api/vehicles/{id}/icon` | Admin or user associated with the vehicle's booking | Read a custom marker image |
| `GET /api/cron/driver-location-retention` | Bearer `CRON_SECRET` | Delete GPS points older than 30 days |

The additive Prisma migration
`prisma/migrations/20261106010000_fleet_mapping` adds vehicle icon metadata,
hub records, driver return-to-hub state, GPS heading, and an index for retention
cleanup. It does not delete existing records. Apply it with `npx prisma migrate
deploy` only after review against the deployment database. Set `CRON_SECRET` to a
long random secret. `vercel.json` schedules the retention endpoint daily at
02:00 UTC; Vercel sends that value as a bearer token. Other hosts must configure
an equivalent daily authenticated schedule, or old GPS records are not purged.

In **Admin → Fleet & management → Scheduled tasks (Cron)**, administrators can
enable or pause GPS retention. The existing `SystemSetting` record
`gpsRetentionEnabled` stores `"true"` or `"false"`; absence preserves the previous
enabled behavior. No schema migration is needed. `POST /api/admin/management`
with `{ "entity": "setting", "data": { "key": "gpsRetentionEnabled", "value": false } }`
pauses cleanup; use the boolean `true` to enable it. Changes are admin-only and
audited. The management response includes `cron.gpsRetentionEnabled` and
`cron.configured` (secret presence only; no secret is returned). An authenticated
scheduled call while paused returns `{ "skipped": true, "reason": "DISABLED",
"removed": 0 }` without deleting positions. The hosting schedule remains active;
enabling does not run an immediate purge, and an already running cleanup may
finish. Invalid stored settings fail explicitly rather than deleting data.

The vehicle registration form appears above driver documents and business cards
in the same management section. Enter the model/name, unique registration plate,
1–50 passenger seats and vehicle icon category. Vehicles are active on creation
and available through the existing dispatch assignment APIs. Duplicate plates
are rejected; custom map icons can be uploaded after registration.

Configure these optional public map settings in the deployment. The defaults
work for development only; public OSM/OSRM/Photon services do not provide an
unlimited production SLA. `NEXT_PUBLIC_GEOCODING_URL` is the complete Photon API
endpoint; `NEXT_PUBLIC_ROUTING_URL` is the OSRM-compatible root URL, to which
`/route/v1/driving` is appended. `NEXT_PUBLIC_MAP_TILE_URL` uses Leaflet's
`{z}`, `{x}`, and `{y}` placeholders.

```env
NEXT_PUBLIC_MAP_TILE_URL="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
NEXT_PUBLIC_ROUTING_URL="https://router.project-osrm.org"
NEXT_PUBLIC_GEOCODING_URL="https://photon.komoot.io/api/"
CRON_SECRET="use-a-long-random-secret"
```

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
