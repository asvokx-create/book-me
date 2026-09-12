# Deploy BubsBookings on DigitalOcean

BubsBookings now uses a DigitalOcean-only architecture:

- **App Platform** runs the Next.js website and server routes.
- **Managed PostgreSQL** stores users, sessions, providers, services, and bookings.
- **Spaces** can be enabled later for provider and service photos.
- **Better Auth** handles secure email/password accounts inside the app.

## 1. Create the database

In DigitalOcean, create a Managed PostgreSQL database in the same region as the app. Use a production database before accepting real customers. Keep public access limited; App Platform should use the private connection string.

For local development, copy `.env.example` to `.env.local` and set `DATABASE_URL` to the database's public connection string. Add your computer to the database's trusted sources while developing.

## 2. Create the account and marketplace tables

From the DigitalOcean app's Runtime Console, run:

```powershell
npm run db:setup
```

This creates Better Auth's user, session, account, and verification tables, including BubsBookings's phone and role fields. It then safely creates BubsBookings's provider, service, availability, booking, and favorite tables. The command can be run again without duplicating the marketplace tables.

## 3. Set secrets

Set these in App Platform's environment settings:

- `DATABASE_URL`: bind it to the database's private URL.
- `DATABASE_CA_CERT`: bind it to `${bookme-db.CA_CERT}` so PostgreSQL's TLS certificate is verified.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters.
- `BETTER_AUTH_URL`: the final public URL, such as `https://bookme.example.com`.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth web application credentials. Add `https://bubsbookings.com/api/auth/callback/google` as an authorized redirect URI in Google Cloud.
- `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`: the Google Analytics web stream measurement ID (starts with `G-`).
- `GOOGLE_SITE_VERIFICATION`: only the `content` value from Google Search Console's HTML verification tag.
- `NEXT_PUBLIC_APP_URL`: the same public URL.
- `BOOKME_REQUIRE_ADMIN_2FA`: after every administrator enables an authenticator under Account > Security, set this to `true` to refuse admin access from accounts without two-factor authentication.

For production, the app intentionally refuses to start without `DATABASE_URL`, `DATABASE_CA_CERT`, a 32-character-or-longer `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `EMAIL_FROM`. This prevents an incomplete deployment from silently using an unverified database connection, a predictable session secret, or accounts whose email addresses were never verified.

Never add `.env.local`, the database password, or the auth secret to GitHub.

## 4. Deploy the app

Push BubsBookings to a private GitHub repository. In DigitalOcean App Platform, choose **Create App**, connect the repository, and use:

- Build command: `npm ci && npm run build`
- Run command: `npm start`
- HTTP port: `8080`

`.do/app.yaml.example` is included as a starting App Platform specification. Replace the repository name and secret before using it. Its development database is suitable for testing; switch to a production Managed PostgreSQL cluster before launch.

## 5. Add uploads later

Create a private DigitalOcean Space and set the `DO_SPACES_*` variables from `.env.example`. Upload support is intentionally not enabled until the provider onboarding flow is connected to real data.

## 6. Schedule reminders and payout releases

Set a long random `CRON_SECRET`, then call `POST /api/cron/booking-reminders` every 10 minutes with the header `Authorization: Bearer YOUR_CRON_SECRET`. That single scheduled request sends due booking reminders and releases provider payments whose 48-hour customer confirmation window has ended. `POST /api/cron/payment-releases` is also available when payout processing needs a separate schedule.

Never expose `CRON_SECRET` in browser code or commit it to GitHub. Monitor the Operations page for failed or delayed payout-release runs.
