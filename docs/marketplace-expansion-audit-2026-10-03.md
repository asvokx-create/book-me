# Marketplace expansion implementation report

Date: October 3, 2026

Status: Safe implementation through the external-recommendations phase. The database migration has not been applied to production, no code has been pushed, and no live money was used. Milestone projects, the project workspace, agreements, and outside-customer invoicing remain intentionally unbuilt so they can receive separate financial and legal review.

## 1. Features already present

The audit found reusable booking, quote, messaging, availability, service-request, Provider Profile, listing-sharing, QR, attachment, notification, email, analytics, admin, refund, dispute, Stripe Connect transfer, Partner commission, Pro-plan, and Book Again systems. The implementation extends those systems rather than creating parallel versions.

## 2. Features added

- Recurring service choices and per-occurrence booking records.
- Up to three service packages and optional quantity-aware add-ons.
- Provider customer-history and rate-limited repeat-offer tools.
- Coupon management for eligible paid plans.
- Consultation listing mode and preparation notes.
- External client recommendation invitations, submission, moderation, and public display.
- Additional repeat-customer revenue metrics.

## 3. Features intentionally not built

External calendar OAuth/sync, milestone projects, a unified project workspace, project agreements, e-signatures, and outside-customer invoices are not in this release. Paid leads, bidding credits, seller tokens, public ranking systems, built-in video, time tracking, monitoring, auctions, crypto, and native mobile apps remain unchanged and unbuilt.

## 4. Database changes

Migration 070 adds service recurrence and consultation metadata, packages, add-ons, coupons, recurring series, immutable booking commerce snapshots, repeat offers, recommendation request tokens, and moderated recommendations. Existing bookings are backfilled so their price invariant remains valid.

## 5. Migrations

`database/migrations/070_service_commerce_foundation.sql` is additive and data-preserving. It uses `IF NOT EXISTS`, backfills existing booking amounts, and adds indexes for the new access patterns. It has not been applied to production. A formal down migration is not included because dropping booking snapshots would destroy new historical data; rollback should disable application use while preserving rows.

## 6. API changes

Booking creation, booking details, provider booking acceptance, listing editing, checkout, Stripe webhooks, provider revenue, and the reminder cron were extended. New protected APIs cover coupons, past customers/repeat offers, recurring-series cancellation, provider recommendation invitations, public recommendation submission, and admin recommendation moderation.

## 7. Recurring booking architecture

The system uses separate ordinary booking/payment records for each occurrence, not Stripe Subscriptions and not silent off-session charging. This preserves the existing booking-level refund, dispute, transfer, review, fee-snapshot, and Partner-commission architecture. A cron creates the next unpaid occurrence up to 30 days ahead; the provider confirms it and the customer pays it explicitly. Past occurrences remain immutable when future recurrence is cancelled. A failed occurrence payment pauses the active series and notifies the customer.

## 8. Stripe recurring tests

Architecture and regression tests confirm that recurring generation creates independent unpaid bookings and never calls Stripe subscription or PaymentIntent creation directly. A real Stripe sandbox matrix was not run because this checkout does not have test database/Stripe credentials. Decline, insufficient-funds, 3DS, retry, refund, dispute, transfer, and reversal scenarios therefore remain mandatory staging checks.

## 9. Package implementation

Providers can configure up to three packages with name, price, description, feature list, duration, delivery time, and revisions. Customers select from responsive cards. The chosen package is copied into the booking snapshot so later edits cannot rewrite history.

## 10. Add-on implementation

Providers can configure add-on name, description, price, added time, quantity support, and maximum quantity. Server-side validation prevents client tampering. Selected add-ons and their total are snapshotted on each booking.

## 11. Repeat customer tools

The provider dashboard now has an owner-only Customers area showing only prior relationship data: display name, service, last completed date, completed count, and value with that provider. Repeat offers require a completed booking, use the existing conversation/message system, allow one offer per customer per 30 days, and allow at most three sends per hour. Existing Book Again behavior remains available.

## 12. Bring-your-own-customer changes

The existing Provider Profile, service links, sharing, and QR system remains canonical. The Marketing area now groups those tools with coupons and recommendation requests. Normal provider links do not create Partner attribution.

## 13. Coupon implementation

Eligible paid-plan providers can create percentage or fixed discounts with first-booking/repeat-customer targeting, minimum subtotal, expiration, and usage limits. Coupons do not stack. Validation occurs server-side and usage is incremented transactionally.

## 14. Consultation implementation

Listings can be marked as consultations and use the existing price, duration, local/remote delivery, availability, date/time, payment, confirmation, messages, and safety systems. Preparation notes were added. Custom intake-question builders were not added in this release.

## 15. Calendar integration status

The existing calendar/availability and ICS behavior was inspected. Google and Microsoft sync were not implemented because the project does not yet have the required OAuth providers, token storage, scopes, revocation flow, free/busy privacy policy, or failure-recovery jobs. Implementing only part of that would create double-booking and privacy risk.

## 16. External recommendation implementation

Providers can create a 14-day, one-use invitation. Only a SHA-256 token hash is stored. Submission is rate-limited, content-scanned, prevented for the provider's signed-in owner, and held for admin moderation. Public profiles show only approved items in a separate Client Recommendations section that explicitly says they are not verified BubsBookings reviews and do not affect ratings.

## 17. Milestone architecture

Recommended future design: one project container with separate immutable milestone payment records, each using the existing separate-charge-and-transfer booking financial pipeline. Paid milestone amounts must lock, and future unpaid milestones may be cancelled. BubsBookings must not call this escrow. This design was documented but not implemented.

## 18. Milestone Stripe tests

Not run because milestones were not implemented and Stripe test credentials are unavailable.

## 19. Project workspace changes

Not implemented. A future workspace should compose the existing booking, quote, message, and attachment systems instead of copying them.

## 20. Contract/project agreement status

Not implemented. The safe future label is Project Details or Project Agreement with two timestamped acceptances. Any stronger legal or e-signature claim requires legal review.

## 21. Invoice status

Not implemented. The marketplace-fee basis, customer service fee, off-platform customer consent, tax handling, and refund policy require a business decision first.

## 22. Starter plan financial tests

Existing fee tests still cover the 10% Starter provider fee and immutable booking snapshots. New booking calculations pass unit/regression tests. A complete live-like Stripe sandbox run remains outstanding.

## 23. Pro plan financial tests

Existing fee tests still cover the 6% Pro provider fee and plan-change-safe snapshots. Coupons are restricted through the existing plan feature model. A complete Stripe sandbox run remains outstanding.

## 24. Customer fee tests

Checkout continues to show the separate $2.99 BubsBookings service fee. Packages and add-ons combine into one occurrence subtotal; a recurring occurrence receives one service fee when that occurrence is paid. Coupons do not discount the service fee. Consultations use the same single-booking rule.

## 25. Partner commission tests

New commerce uses the existing immutable provider-fee snapshot, so Partner share remains based on eligible BubsBookings provider marketplace-fee revenue, never gross booking value. Existing attribution, hold, expiry, dispute, and reversal tests remain green. A sandbox end-to-end Partner run for every new selection type remains outstanding.

## 26. Refund tests

Existing booking-level refund behavior is preserved because every recurring occurrence and consultation is an ordinary booking with a final service subtotal snapshot.

## 27. Partial refund tests

Existing proportional provider-fee and Partner-commission adjustment tests remain green. Add-on/package line details remain in the immutable snapshot for support review.

## 28. Dispute tests

Existing dispute tests remain green and continue to operate per booking/occurrence. No milestone-specific dispute test exists.

## 29. Chargeback tests

Existing chargeback freeze and Partner-ledger reversal tests remain green. No live Stripe test-mode simulation was run in this environment.

## 30. Provider transfer tests

The existing held transfer architecture remains unchanged. Checkout uses the final discounted service subtotal and the snapshotted fee. No live Stripe test transfer/reversal was run.

## 31. Authorization results

Provider commerce editing, coupon management, customer history, repeat offers, and recommendation invitations require provider ownership. Repeat offers require a completed relationship. Recommendation moderation requires admin authorization. Public recommendation submission is token-scoped, single-use, expiring, and rate-limited.

## 32. Mobile results

The anonymous recommendation flow was visually inspected at 320, 360, 375, 390, 393, 412, and 430 pixels. Fields and actions remained inside the viewport with no horizontal scrolling. Package/add-on/recurrence controls use responsive cards rather than desktop tables; authenticated flows still need a staging-session visual pass.

## 33. Tablet results

The recommendation flow was checked at 768 and 1024 pixels without overflow. Authenticated provider/customer screens still need staging-session visual verification.

## 34. Desktop results

The recommendation flow was checked at 1280, 1440, and 1920 pixels. The form remains width-bounded rather than stretching across the viewport.

## 35. 4K results

The recommendation flow was checked at 2560, 3440, and 3840 pixels. Content remains capped and readable.

## 36. Dark mode results

The new controls inherit the existing neutral dark-mode input, surface, border, focus, and placeholder rules, and the dark-mode regression suite passes. The anonymous local browser session defaulted to light mode and had no public appearance switch, so a full authenticated dark-mode screenshot pass remains a staging task.

## 37. Accessibility results

New forms use labels, fieldsets/legends where appropriate, semantic links/buttons, visible focus styles, live status/error text, bounded touch targets, and descriptive public copy. Automated lint and structural accessibility checks pass. A manual screen-reader pass remains advisable.

## 38. Performance impact

Service detail adds two small indexed child queries for packages/add-ons. Recurring generation is bounded, indexed, and advisory-locked to prevent duplicate occurrences. Customer/recommendation queries are provider-scoped and paginated or limited. No external calendar polling or project join graph was added.

## 39. Emails added

Recommendation-request email and existing booking-update emails are reused. Recurring occurrence creation calls the existing booking email path. Payment failure currently creates an in-app notification; a dedicated failure email remains a follow-up.

## 40. Notifications added

Upcoming recurring occurrence, provider recurring request, recurring-payment pause, repeat offer, and recommendation workflow notifications use the existing notification table and stable dedupe keys.

## 41. Analytics events

Booking creation records package, add-on, recurrence, coupon, consultation, and repeat-booking context through the existing analytics helper. No new analytics vendor was added.

## 42. Tests added

`tests/service-commerce.test.ts` covers calculation, tamper limits, coupon safeguards, and recurrence date behavior. `tests/marketplace-expansion.test.ts` covers snapshots, no silent recurring charge, payment-failure pause, repeat-offer controls, marketing/affiliate separation, coupon policy, content safety, and recommendation trust rules. Full result: 212/212 tests passing, lint passing, TypeScript passing, and production build passing.

## 43. Anything requiring manual testing

Run authenticated customer/provider/admin flows against a migrated staging database, including editing listings, applying coupons, provider acceptance, customer checkout, whole-series/one-occurrence cancellation, repeat offer delivery, moderation, keyboard-only navigation, screen reader output, and authenticated dark mode.

## 44. Anything requiring Stripe configuration

Stripe test secret/publishable keys, webhook secret, connected test accounts, a migrated staging database, and test webhook delivery are required for the requested card/3DS/refund/dispute/transfer matrix. Never use live credentials or real cards for that matrix.

## 45. Anything requiring legal review

Recurring cancellation wording, external-recommendation disclosures, future Project Agreement naming/acceptance, any escrow-like language, outside invoicing, tax treatment, and calendar privacy disclosures.

## 46. Anything requiring a business decision

Whether coupons remain Pro-only, coupon funding (implemented as provider-funded), whether coupons may apply to later recurring occurrences (implemented as first occurrence only), recurring cancellation lead time, dedicated payment-failure email/retry policy, milestone service-fee frequency, and all outside-invoice fee/tax rules.

## 47. Anything intentionally left unchanged

No lead fees, no pay-to-message model, Starter 10% fee, Pro 6% fee, $2.99 customer service fee, booking-level Stripe transfers, refund/dispute ledgers, Partner attribution rules, QR/share URLs, messages, attachments, reviews, Provider Profiles, current analytics provider, and existing notification/admin architecture.

## Files changed

The implementation is concentrated in migration 070, `lib/service-commerce.ts`, `lib/recurring-bookings.ts`, booking/listing/checkout/webhook routes, the listing editor and booking card, provider customer/coupon/recommendation components, admin recommendation moderation, public recommendation pages, marketplace loading, and the two new test files. Use `git status --short` for the exact current list before committing.
