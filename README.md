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

Customer reservations are written to PostgreSQL and receive a unique reference.
The server supplies the displayed quote and calculates the booking price from the
latest effective, active matching fare; without a matching fare, it uses USD 35.
The price is recalculated on submission if a published fare has changed.
Administrators can set a trip price, assign an active/available driver and an active
vehicle with sufficient seats. Editing the same assignment preserves trip progress;
an ongoing trip cannot be reassigned.

Drivers advance only their own trips through:
`DRIVER_ASSIGNED -> DRIVER_ACCEPTED -> DRIVER_EN_ROUTE -> DRIVER_ARRIVED -> TRIP_STARTED -> TRIP_COMPLETED`.
Invalid/skipped transitions, foreign bookings and concurrent stale updates are rejected.
Trip changes retain status history and audit records. Assignment does not confirm payment.

Accounts, vehicles, fares and contracts are deactivated rather than deleted.
Trips are cancelled, not removed. Financial history cannot be deleted through the
management API. Use **Edit records and settings** to edit existing records or
create fares/contracts; account roles remain immutable, and administrators cannot
suspend themselves. Driver availability and license details are editable.
Homepage image settings are now shared through the database.

Online payment processing, shared live GPS and driver messaging are not connected.
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
