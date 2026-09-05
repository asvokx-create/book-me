# BubsBookings production operations

## Required DigitalOcean environment variables

- `RESEND_API_KEY`: transactional-email API key.
- `EMAIL_FROM`: verified sender, for example `BubsBookings <updates@bookme.example>`.
- `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`: the final HTTPS BubsBookings address.

Optional fallback:

- `CRON_SECRET`: a long random value used only when an external service calls the manual reminder endpoint.

## Appointment reminder job

The production web service starts an internal reminder check every 10 minutes and records each run. It sends 24-hour and 1-hour reminders for confirmed bookings and uses idempotency keys to avoid duplicates. The protected `/api/cron/booking-reminders` endpoint remains available as a manual fallback; send `Authorization: Bearer <CRON_SECRET>` when using it.

## Monitoring

Connect an uptime monitor to `/api/health`. Alert if it returns anything other than HTTP 200 or if `database` is not `connected`. Admins can review email and reminder status at `/admin/operations`.

## Backups

Use a DigitalOcean Managed PostgreSQL production cluster with automatic backups and point-in-time recovery enabled. Keep the database in the same region as the app. Test a restore into a separate temporary database before launch and quarterly afterward. Never store database backups in the public app repository or a public Space.
