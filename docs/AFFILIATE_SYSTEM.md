# BubsBookings partner and affiliate system

## Launch architecture

- Attribution uses the last valid affiliate referral before the provider profile is created.
- A valid code deliberately entered during provider onboarding replaces a saved referral cookie.
- Attribution locks when the provider profile and first listing are created. Later link clicks do not change it.
- Program terms and affiliate-specific overrides are copied onto the provider referral at attribution time.
- The standard program starts with a $10 activation bonus, 20% of eligible provider marketplace-fee revenue for six months, a 60-day attribution window, a 30-day commission hold, and a $50 payout minimum.
- The customer service fee is excluded unless a future program explicitly adds it as an eligible revenue type.

## Financial lifecycle

Affiliate commission is created only after the booking is completed and the provider payout is successfully released. The calculation uses the booking's immutable `platform_fee_cents` and provider-plan snapshot, not the provider's current plan or gross service price. Partial service refunds proportionally reduce eligible fee revenue. Full refunds, lost chargebacks, and ineligible bookings reject unpaid commission or create a separate negative reversal when money was already paid. Ledger history is never deleted.

The existing payment-release cron also advances held affiliate commissions to payable after their program hold expires, provided no open refund, marketplace dispute, or Stripe dispute blocks the booking.

## Affiliate payouts

Affiliate payouts are intentionally separate from provider Stripe Connect transfers. The initial production workflow is administrator-reviewed and manual:

1. Confirm the affiliate's tax and payment readiness outside the payout action.
2. Create a payout in `/admin/affiliates` after the payable balance reaches the snapshotted minimum.
3. Send the payment using the approved business payment method.
4. Record the external payment reference with **Mark paid**.

This preserves an auditable payout statement and lets automated affiliate payouts be added later without changing commission history. Do not reuse provider connected accounts for affiliate payments without a separate compliance and Stripe architecture review.

## Routes

- `/partners` — public program explanation and reviewed application
- `/affiliate` — authenticated partner dashboard, analytics, link builder, QR code, referrals, commissions, and payout history
- `/admin/affiliates` — applications, programs, custom terms, commissions, reversals, adjustments, and payouts
- `/partner-agreement` — partner program legal terms

## Operations and safeguards

- Codes are case-insensitive, URL-safe, unique, and checked against reserved BubsBookings names.
- Referral cookies are first-party, HTTP-only, SameSite=Lax, Secure in production, and expire according to the program.
- Public application and click endpoints are rate limited and do not store raw IP addresses.
- Link generation is limited to approved internal BubsBookings destinations.
- Affiliates receive business-level referral progress only; customer data, street addresses, payment credentials, fraud details, and admin notes remain private.
- Every admin financial or status mutation writes an affiliate audit record.

## Production rollout checklist

1. Deploy so migration `058_affiliate_partner_system.sql` is applied by the normal database setup step.
2. Review the Partner Agreement, Terms, Privacy Policy, and Cookie Notice with qualified counsel before public enrollment.
3. Decide and document the approved affiliate payment method and tax-document collection process.
4. Set partner `tax_onboarding_status` and `payment_status` to ready only after the required checks are complete.
5. Use a test affiliate and Stripe test booking to verify click → onboarding → completed booking → hold → payable → payout statement.
6. Confirm refund, partial refund, marketplace dispute, and Stripe chargeback scenarios before enabling the first public program.
