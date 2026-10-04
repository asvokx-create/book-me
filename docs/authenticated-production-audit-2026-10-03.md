# Authenticated production audit and cleanup

**Audit date:** October 3, 2026  
**Scope:** Read-only production inspection as the authenticated owner/admin; repository, migration, route, and regression-test review; responsive checks on the live homepage; local lint, tests, and production build.  
**Important limit:** No production records were created, edited, paid, refunded, disputed, or deleted. No Stripe sandbox transaction was initiated from this checkout because it has no local production/test credentials, and a live browser transaction would require an explicit action-time confirmation. This report never treats an unexecuted financial scenario as passed.

## 1. Confirmed bugs

- The public Partner Agreement exposed an internal drafting label and review sentence. Fixed without changing the underlying milestone policy.
- Partner acquisition, its Open Graph image, customer messaging, and the mobile homepage request prompt still used local-only copy despite remote providers being supported. Fixed.
- Provider pricing did not directly state the already-established $2.99 customer service fee. Fixed.
- Production contains one completed booking while the operations dashboard reports zero paid bookings. This may be legacy/test data; it was not mutated.
- Production contains a legacy active Partner record with no linked verified BubsBookings account. New approval is blocked correctly, but the historical record needs owner review.

## 2. Issues already correct

Remote delivery rules, booking delivery snapshots, Partner authentication for new applications, program selection on approval, affiliate fee-revenue basis, milestone uniqueness, Pro seat arithmetic, checkout fee snapshots, refund/payout guards, public address privacy, route ownership checks, SEO routes, cookie controls, and the existing responsive/dark-mode system are implemented and covered by regression tests.

## 3. Issues not reproducible

No horizontal page overflow, missing public image alt text, duplicate remote/Both search result, collapsed “More Services Coming Soon” icon, or category-label overflow was reproduced in the inspected production homepage. The current public and authenticated core pages each rendered one H1.

## 4. Public legal drafting notes removed

The Partner Agreement heading is now `Provider Growth Milestones`, and the internal review sentence is gone. A new regression scans every public policy page for prohibited drafting labels.

## 5. Legal review items

Counsel should still review milestone compensation, entity/contact disclosures, retention periods, state privacy and automatic-renewal requirements, governing law, liability limits, UGC/DMCA process, suspension appeals, and review moderation. These questions remain in internal documentation only.

## 6. Provider join findings

`/providers/join` supports In person, Remote, and Both; remote skips the radius control; copy covers local and online work. No stale local-only join claim was found.

## 7. Remote/local findings

Database constraints use non-null `IN_PERSON`, `REMOTE`, or `BOTH`; search bypasses radius for remote; Both can serve either booking method; remote booking does not require a street address; booking delivery is snapshotted. Stale surrounding copy found in Partner, messages, and mobile request surfaces was corrected.

## 8. Provider Profile findings

Profiles label delivery type, hide private addresses, support portfolio/reviews/languages/experience, and suppress inappropriate local-area copy for remote-only providers. Public production currently exposes three provider/listing brands; their legitimacy was not assumed.

## 9. Screening freshness findings

Material account, profile, service, location, and Stripe-state changes re-run automated verification, and public badges depend on the current pass state. No scheduled age-based revalidation was found. This is an operational/legal decision, not a timestamp to rewrite.

## 10. Partner account requirement

New applications require an authenticated account, configured email verification, explicit agreement acceptance, and server-side user-ID ownership. Duplicate states return 409. New approval is blocked without a linked account. One historical active unlinked Partner remains in production for manual review.

## 11. Standard Partner behavior

Standard terms support activation bonus, revenue share, and milestones. Referral terms are snapshotted and later program edits do not rewrite prior referrals.

## 12. Custom Partner behavior

Backend flags independently gate activation, revenue share, milestones, and custom campaign visibility/work. Disabled milestones exit before ledger, notification, or email work.

## 13. Preston-style test

The data model/admin form can represent a $500 one-month campaign, 20% share for six months, with activation and milestone bonuses disabled. Source-level tests confirm disabled bonus paths; no production Partner was converted for this audit.

## 14. Partner milestone tests

Thresholds are 10/$50, 25/$100, 50/$250, and 100/$500. Active Provider requires four qualified paid bookings. A unique `(affiliate_id, milestone_threshold)` constraint and stable notification/email keys enforce idempotency.

## 15. Pro seat tests

Owner counts as one of three included seats; pending invitations reserve capacity; additional seats cost $0.50/month; safe quantity reduction considers active workers and pending invitations.

## 16. Stripe seat tests

Pure calculations pass for $9.99, $10.49, $10.99, and $12.49. Subscription item quantity, proration, payment-failure grace, and cancellation cleanup are wired. No Stripe sandbox mutation was performed in this pass.

## 17. Recurring booking tests

Weekly, biweekly, monthly date generation and series cancellation are implemented. Future occurrences preserve package/add-on/delivery snapshots and require separate confirmation/payment; the product does not silently auto-charge a saved card. End-to-end payment failure/refund/dispute scenarios remain manual sandbox work.

## 18. Package tests

Package price/duration feeds booking totals and immutable JSON snapshots. Server validation rejects unavailable package IDs. No live test listing was created.

## 19. Add-on tests

Single, multiple, and quantity-limited add-ons are server-calculated; non-quantity add-ons cannot be multiplied; duration and line totals are snapshotted. No live purchase was made.

## 20. Coupon tests

Percentage/fixed discounts, minimum, expiry, usage limit, first/repeat eligibility, concurrent reservation, and non-negative totals are enforced. One coupon per booking is supported; invalid stacking is therefore unavailable.

## 21. Consultation tests

Consultations reuse the normal immutable booking/payment/delivery workflow and external meeting coordination through messages. No built-in video calling is claimed. A live 30/60-minute purchase was not made.

## 22. Milestone project tests

**Confirmed incomplete:** the schema reserves `booking_kind='milestone'`, but no three-milestone project model, UI, independent payment states, or partial milestone refund/dispute workflow exists. Implementing it would be feature expansion, so it was not invented during this cleanup.

## 23. Repeat customer tests

Book Again requires ownership of a completed prior booking, uses current service availability/pricing, and provider customer tools are access-controlled. Repeat offers are recorded in-app.

## 24. Marketing tools tests

Provider profile/listing links, copy/share, and QR generation reuse canonical service URLs and do not append Partner referral attribution.

## 25. Service request tests

Remote, in-person, and either matching are category/delivery/eligibility aware; remote ignores radius; exact address is withheld; quote acceptance creates the booking snapshot. Queue dedupe/retry logic prevents duplicate opportunity emails.

## 26. Search tests

All/In person/Remote filters, location/radius behavior, Both inclusion, local SEO exclusion of remote-only listings, and duplicate prevention are implemented. Live homepage showed two local and one wider-area listing without duplication.

## 27. Mobile Safari results

Source/regression coverage includes 320–768 layouts, safe-area padding, dynamic viewport units, and overflow containment. Live responsive checks from approximately 360 through 1920 CSS pixels showed no page overflow or category-card overflow. Native iPhone Safari was not available; final device testing remains manual.

## 28. Pricing findings

Starter $0/10%, Pro $9.99/6%, one 30-day eligible trial, automatic renewal, three included seats, and $0.50 extra seats are disclosed. The separate $2.99 customer service fee is now also stated directly on Pricing.

## 29. Customer fee findings

The $2.99 fee is added once per booking/payment snapshot across normal, package, add-on, consultation, recurring-occurrence, and milestone-kind records. It is separate from provider price/payout. Whether every separately paid project milestone should carry its own fee is a business decision because the complete milestone-project feature is absent.

## 30. Booking snapshot findings

Plan, fee basis points, platform fee, provider payout, customer fee/total, delivery, package, add-ons, coupon code, recurrence index, and booking kind are stored on the booking. Historical refund calculations use the stored fee basis rather than current plan settings.

## 31. Partner commission findings

Commission uses eligible snapshotted provider marketplace fee revenue, not gross booking amount or the customer service fee. Partial refunds reduce eligible fee revenue proportionally; full refunds remove it.

## 32. Refund tests

Full/partial calculations, service-fee return rules, provider-net adjustment, transfer reversal/offset, and affiliate resynchronization are implemented. No sandbox refund was submitted.

## 33. Dispute tests

Open disputes freeze payout and commission; provider-won disputes can restore eligibility; lost disputes preserve reversal history. No sandbox dispute was submitted.

## 34. Chargeback tests

Stripe `charge.dispute.created/closed` handling freezes/reconciles provider and Partner states with stable ledger history. No chargeback simulation was run.

## 35. Provider payout tests

Release requires paid/completed/eligible state, no open dispute/blocking refund/freeze, and no prior transfer. Stable idempotency keys prevent duplicate transfers. Production reports payouts ready but no live paid bookings.

## 36. Admin findings

Authenticated admin pages loaded for overview, Partner operations, reliability operations, expenses, disputes/support/requests, listings, reviews, payouts, accounts, and audit history. Commerce details are visible through listing/booking/account records; there is not a dedicated top-level tab for every commerce subtype.

## 37. Authorization findings

Admin layout is server-gated; provider routes use ownership/team access; customer booking routes use customer ID; Partner dashboard/payout routes use linked user ID; workers cannot change owner billing. Full multi-account adversarial browser testing remains manual.

## 38. Privacy findings

Public profiles expose general service areas, not private provider/customer addresses. Exact addresses are revealed only to authorized booking participants; remote bookings collect none. Stripe credentials remain Stripe-hosted; Partner earnings and admin notes stay private.

## 39. Legal consistency findings

Public policies consistently describe marketplace status, separate Stripe charges/transfers, non-escrow handling, remote/local work, refunds/disputes, Partner fee-revenue basis, analytics choice, and limited verification. Only the internal milestone review label was inconsistent and is fixed.

## 40. Email findings

Transactional templates use stable idempotency where required and distinguish Partner milestone/custom settings. Recurring occurrence emails say payment is handled separately. No stale local-only email string was found.

## 41. Notification findings

Booking, message, opportunity, Partner milestone/application, recurring booking, and payment-failure paths use dedupe keys or unique records. No production notification was triggered.

## 42. SEO findings

`robots.txt`, dynamic sitemap, canonical URLs, listing/provider/company metadata, Open Graph routes, guides, Partner page, and local-location pages are present. Local SEO routes explicitly exclude remote-only services. Partner Open Graph copy now includes all service providers.

## 43. Performance findings

Marketplace queries use bounded result sets and spatial/filter SQL; relevant delivery, recurring, coupon, milestone, and team indexes exist. No production load test or query-plan capture was performed, so this is not a performance certification.

## 44. Accessibility findings

Core production pages rendered one H1, a skip link, accessible navigation, and zero visible images without alt text. Forms generally use wrapping labels, keyboard focus styles exist, and complex admin tables have labeled scroll regions. Full screen-reader, contrast-tool, and every-modal focus-cycle testing remains manual.

## 45. Dark mode findings

Neutral dark-mode rules cover public, authenticated, admin, Partner, pricing, search, form, and status surfaces; the automated dark-mode audit passes. A full native device/state matrix was not completed in the live browser.

## 46. Files changed

- `app/partner-agreement/page.tsx`
- `app/partners/page.tsx`
- `app/partners/opengraph-image.tsx`
- `app/account/messages/page.tsx`
- `app/page.tsx`
- `app/pricing/page.tsx`
- `tests/legal-pages.test.ts`
- `tests/remote-services.test.ts`
- `tests/booking-financials.test.ts`
- `docs/compliance-audit-2026-10-03.md`
- `docs/authenticated-production-audit-2026-10-03.md`

## 47. Database changes

None.

## 48. Migrations

None added or modified.

## 49. Tests added

- Public policy pages reject internal drafting labels.
- Partner/customer copy cannot regress to local-only language.
- Pricing must disclose the separate $2.99 customer service fee.

## 50. Anything requiring Stripe configuration

Verify live/test webhook endpoints and secrets, cron secret, Stripe Connect capabilities, Pro price/product, and the auto-created `$0.50/month` extra-seat lookup-key price in each Stripe mode. Run sandbox subscription/proration/refund/dispute/transfer checks with explicit action-time approval.

## 51. Anything requiring manual testing

Native iPhone Safari, screen reader/keyboard/contrast matrix, separate customer/provider/worker/Partner accounts, production data classification, email inbox delivery, and all Stripe sandbox mutations.

## 52. Anything requiring a business decision

- Whether future recurring visits should remain separately paid or become automatic off-session charges.
- Whether each future project milestone should carry a separate $2.99 service fee.
- Whether/when provider screening should expire and re-run periodically.
- Whether to deactivate or link the historical unowned active Partner.
- Whether the completed-without-payment booking is legitimate legacy history or removable test data.
- Whether to build the currently absent full milestone-project product in a separate feature task.

## 53. Anything intentionally unchanged

No production users, Partners, listings, bookings, ledger entries, reviews, payouts, or test-looking records were deleted or edited. No legal clause was invented. Existing referral snapshots and financial history were not rewritten. No real or sandbox financial transaction was initiated.

## Verification summary

- Automated tests: **231 passed** after this audit's new checks.
- Lint: **passed**.
- Production build: **passed** (with network access for the configured Google font fetch).
- Production UI: public policy/program/provider/pricing pages plus authenticated customer, provider, Partner-admin, operations, team, billing, and expense surfaces inspected read-only.
