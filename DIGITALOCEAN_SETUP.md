# Deploy BookMe on DigitalOcean

BookMe now uses a DigitalOcean-only architecture:

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

This creates Better Auth's user, session, account, and verification tables, including BookMe's phone and role fields. It then safely creates BookMe's provider, service, availability, booking, and favorite tables. The command can be run again without duplicating the marketplace tables.

## 3. Set secrets

Set these in App Platform's environment settings:

- `DATABASE_URL`: bind it to the database's private URL.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters.
- `BETTER_AUTH_URL`: the final public URL, such as `https://bookme.example.com`.
- `NEXT_PUBLIC_APP_URL`: the same public URL.

Never add `.env.local`, the database password, or the auth secret to GitHub.

## 4. Deploy the app

Push BookMe to a private GitHub repository. In DigitalOcean App Platform, choose **Create App**, connect the repository, and use:

- Build command: `npm ci && npm run build`
- Run command: `npm start`
- HTTP port: `8080`

`.do/app.yaml.example` is included as a starting App Platform specification. Replace the repository name and secret before using it. Its development database is suitable for testing; switch to a production Managed PostgreSQL cluster before launch.

## 5. Add uploads later

Create a private DigitalOcean Space and set the `DO_SPACES_*` variables from `.env.example`. Upload support is intentionally not enabled until the provider onboarding flow is connected to real data.
