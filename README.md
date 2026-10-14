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

Administrator and driver creation, customer profiles, fleet management, accounting
and forecasts use the database. Driver and customer lists reload from the same
database-backed management data as the accounts table. Failed writes display an
error and preserve form inputs; expired sessions require signing in again.
Use **Fleet management** to add vehicles; the former browser-only vehicle form
has been removed.

The dashboard's sample statistics and booking, dispatch, pricing publication,
booking submission, driver trip actions, tracking and messages are not yet fully
connected to persistence. Dispatch and pricing controls in `/admin` are disabled
and marked as demonstration features. Homepage background changes remain local to
the browser. A configured database does not mean all screens are operational.
The service worker does not cache API responses or substitute cached management
data when the database/server is unavailable.

### Integration checks

With the application running (`npm run dev`) and database variables configured,
run `npm test`. The tests exercise driver creation and login, customer profiles,
fleet, accounting and forecasts against the real application and database.
They create uniquely named test accounts and records, then remove them in cleanup.
Prefer a dedicated test database and run the application against that same database.
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
