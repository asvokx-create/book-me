# BubsBookings production operations

## Required DigitalOcean environment variables

- `RESEND_API_KEY`: transactional-email API key.
- `EMAIL_FROM`: verified sender, for example `BubsBookings <updates@bookme.example>`.
- `CRON_SECRET`: a long random value used only by the reminder job.
- `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`: the final HTTPS BubsBookings address.

## Appointment reminder job

Schedule an HTTPS POST to `/api/cron/booking-reminders` every 10 minutes. Send the header `Authorization: Bearer <CRON_SECRET>`. The endpoint is idempotent and records each run.

## Monitoring

Connect an uptime monitor to `/api/health`. Alert if it returns anything other than HTTP 200 or if `database` is not `connected`. Admins can review email and reminder status at `/admin/operations`.

## Backups

Use a DigitalOcean Managed PostgreSQL production cluster with automatic backups and point-in-time recovery enabled. Keep the database in the same region as the app. Test a restore into a separate temporary database before launch and quarterly afterward. Never store database backups in the public app repository or a public Space.
