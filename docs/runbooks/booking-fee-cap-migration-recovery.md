# Booking fee-cap migration: deployment and recovery

This runbook covers `database/migrations/093_booking_fee_caps_and_processing_costs.sql`.

## Before applying

1. Take and verify a restorable backup of the target PostgreSQL database.
2. Apply the migration to a disposable or staging database that contains a representative copy of the `bookings` schema.
3. Run the payment regression suite and a Stripe **test-mode** checkout against that staging database.
4. Deploy the application code that writes and reads the new columns together with the migration. Do not deploy checkout code that references the new columns before the schema is available.

## What the migration changes

The migration adds nullable `provider_fee_cap_cents` and `stripe_processing_fee_cents`, plus non-null `provider_processing_fee_cents` (defaulting to zero) and `processing_fee_status` (defaulting to `not_applicable`). It adds non-negative and allowed-status constraints.

It deliberately performs no `UPDATE` against existing bookings. Existing booking totals, payment records, payouts, refunds, and their recorded fee terms remain the historical source of truth. New checkout code supplies the fee-cap snapshot and starts processing-fee reconciliation as `pending`.

The statements use `IF NOT EXISTS`, so it is safe to re-run the migration after an interrupted deployment once the schema is inspected.

## If migration or deployment fails

1. Stop the application release before enabling new checkout requests.
2. Inspect the `bookings` columns and constraints, then keep the prior application release serving traffic if the new code has not been fully deployed.
3. Correct the deployment cause and re-run the same migration. The migration is additive and idempotent.
4. Do not alter existing booking amounts, Stripe records, transfers, refunds, or affiliate records as a recovery shortcut.

## Schema rollback (staging or pre-traffic only)

Only use this after a verified backup and only when no new booking has relied on these fields. Dropping these columns destroys the new reconciliation snapshots. For a live system with any new fee-cap bookings, restore from a tested backup or use a reviewed forward migration instead.

```sql
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_provider_fee_cap_cents_check,
  DROP CONSTRAINT IF EXISTS bookings_stripe_processing_fee_cents_check,
  DROP CONSTRAINT IF EXISTS bookings_provider_processing_fee_cents_check,
  DROP CONSTRAINT IF EXISTS bookings_processing_fee_status_check,
  DROP COLUMN IF EXISTS provider_fee_cap_cents,
  DROP COLUMN IF EXISTS stripe_processing_fee_cents,
  DROP COLUMN IF EXISTS provider_processing_fee_cents,
  DROP COLUMN IF EXISTS processing_fee_status;
```

## Reconciliation follow-up

Processing fees are finalized only after Stripe exposes the charge balance transaction. Reconciliation is idempotent: a booking already marked `final` returns its stored values without recalculating the payout. Monitor pending reconciliations and transfer failures, and investigate a failed or delayed reconciliation before releasing a provider payout.
