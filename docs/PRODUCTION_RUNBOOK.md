# BubsBookings production runbook

## Every day

- Check the DigitalOcean App Platform deployment and runtime alerts.
- Check `/api/health`; any non-200 response means the database is unavailable.
- Review Stripe webhook failures, refund failures, payout restrictions, and email failures.
- Review the Admin Reliability Center for payment, refund, safety, and account activity.

## Backups and recovery

1. Enable automatic backups and point-in-time recovery on the production DigitalOcean PostgreSQL database.
2. Keep the application and database in the same DigitalOcean region and restrict database access to trusted sources.
3. Once a month, restore the newest backup into a separate non-production database and run a smoke test.
4. Record the restore date and result in the operations log. A backup is not considered verified until a restore succeeds.

## Monitoring

- Configure an external uptime monitor for `https://bubsbookings.com/api/health` every five minutes.
- Alert the owner for two consecutive failures, slow responses, failed deployments, database resource pressure, or Stripe webhook failures.
- Schedule the private reminder endpoint every ten minutes using `CRON_SECRET`; never put the secret in a public URL or client code.

## Payment incident

1. Do not mark a booking paid manually unless Stripe shows a successful PaymentIntent.
2. Retry failed webhooks from Stripe after fixing the cause; webhook IDs are deduplicated.
3. Approve refunds from the booking page. Refunds go to the original payment method and reverse the provider transfer.
4. For a chargeback, preserve the booking history, messages, quote, cancellation details, and service evidence for the dispute response.

## Stripe webhook events

- Keep the production webhook subscribed to Checkout payment events, subscription created/updated/deleted events, `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`, account updates, refunds, and failed PaymentIntents.
- Stripe sends `customer.subscription.trial_will_end` shortly before a Pro trial expires. Confirm the event is delivered so BubsBookings can send the provider an in-app and email renewal reminder.

## Pro team seats

- Pro includes three total seats: the provider owner plus two workers. Active workers and pending invitations both reserve a seat.
- Extra seats are a licensed recurring subscription item at $0.50 USD per month. The application finds it using the Stripe lookup key `bubs_pro_extra_team_seat_usd_monthly_v1` and safely creates the product/price in the current Stripe mode if it does not exist. No dashboard-created price ID is required.
- Seat increases and reductions use Stripe prorations. A reduction produces a Stripe billing credit/adjustment according to the subscription's invoice state; it does not issue an automatic cash refund.
- A past-due invoice keeps Pro and team access during Stripe's retry grace period. An unpaid, ended, or deleted subscription returns the provider to Starter, stops the seat item with the parent subscription, and deactivates team access without deleting team records.
- Before every release, test in Stripe test mode: 0, 1, 2, and 5 extra seats; an attempted reduction below reserved seats; a failed invoice followed by recovery; cancellation at period end; and the final subscription deletion webhook.

## Release check

- Run lint, TypeScript checking, and the production build.
- Confirm sign-up, provider payout onboarding, search, booking, messaging, payment, cancellation, refund, and admin reporting in test mode.
- Do not switch keys or process a real charge without the owner’s action-time approval.
