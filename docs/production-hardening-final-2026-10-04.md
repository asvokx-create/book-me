# BubsBookings production hardening report

Date: October 4, 2026

## Executive result

The codebase, production routes, authenticated dashboards, mobile layouts, dark theme, and critical marketplace controls received a final hardening pass. The pass fixed stale provider-screening authorization, company delivery-mode presentation, an insecure production auth-secret fallback, DigitalOcean client-IP rate limiting, and a critical production dependency advisory.

Verification completed:

- 245 automated tests passed.
- ESLint passed with no errors.
- The Next.js 16.3.8 production build completed successfully and generated 121 routes.
- The production-dependency audit reported 0 vulnerabilities.
- The affiliate sandbox simulation passed without a live Stripe key or real-money action.
- Important public, authenticated, provider, affiliate, and admin routes were opened in production.
- Responsive checks covered 320, 360, 375, 390, 393, 412, 430, 600, 768, 1024, 1366, 1920, and 3840 pixel overrides, plus focused route checks at 320, 390, 768, and 1440.

This is not represented as a literal 10/10 yet. Live Stripe test credentials and a test database were not available locally, so real Stripe sandbox object creation, refunds, transfers, webhook replay, subscriptions, and full multi-account journeys remain manual release gates. Mobile Safari also requires a real iPhone/Safari pass.

## Requested final report

1. **Bugs found** — A critical Next.js production advisory; expired provider screenings still qualifying company trust badges and service-request actions; quote acceptance not rechecking complete provider eligibility; company pages treating remote services as local; an insecure production fallback auth secret; and one shared Better Auth rate-limit bucket behind DigitalOcean.
2. **Bugs fixed** — Upgraded Next.js; enforced 30-day screening freshness in public company data, opportunity matching, request actions, quote creation, quote display, and quote acceptance; added current Stripe/account eligibility to acceptance; corrected company remote/BOTH labels; made production refuse a missing auth secret; and configured DigitalOcean's real-client-IP header.
3. **Root cause** — Several newer flows reused permanent `is_verified` state without the shared screening freshness rule. Company presentation assumed locations were always the main availability signal. Better Auth defaulted to `x-forwarded-for`, while DigitalOcean App Platform supplies the real client through `do-connecting-ip`. The framework version had fallen behind a security patch.
4. **Files changed** — `app/api/job-requests/route.ts`, both request action/quote routes, `app/api/quotes/[quoteId]/route.ts`, `app/companies/[slug]/page.tsx`, `lib/companies.ts`, `lib/auth.ts`, `package.json`, `package-lock.json`, and four focused test files including the new production-auth test.
5. **Database changes** — None.
6. **Migrations** — None added. Production logs showed migrations through 074 applied successfully before this pass.
7. **Stripe sandbox tests** — The local affiliate sandbox simulation passed and refuses live Stripe credentials. No Stripe API request was sent because no test secret was present.
8. **Stripe configuration changes** — None.
9. **Payment test results** — Financial snapshot, fee, payout guard, idempotency, package, add-on, coupon, and customer-fee tests passed. A real test-mode PaymentIntent remains required.
10. **Refund test results** — Full/partial refund and commission-reversal logic tests passed. Real Stripe test-mode refund objects were not created in this pass.
11. **Subscription test results** — Pro pricing, past-due grace, cancellation/webhook rules, and seat totals passed automated tests. Real test-mode subscription creation, proration, failure, renewal, and cancellation remain manual.
12. **Team seat test results** — 3 included seats and exact totals of $9.99, $10.49, $10.99, and $12.49 are covered and passed. Active workers plus pending invitations set the safe minimum; downgrade protection is covered.
13. **Partner commission results** — The simulation produced $5.00 revenue share from a $25.00 eligible BubsBookings provider fee, not the $250 booking value, plus the configured $10 activation bonus. The 20% rate stops after six calendar months and does not earn at the exact end boundary.
14. **Standard Partner results** — Activation, revenue share, qualification, hold, reversal, payout readiness, and milestone rules passed. The current standard hold is 14 days.
15. **Custom Partner results** — Enable/disable controls, custom terms, program assignment, campaign separation, and snapshot preservation are covered. A full Preston-style Stripe/database journey remains a manual scenario without test infrastructure.
16. **Remote service results** — Remote discovery, address-free booking/request behavior, local SEO exclusion, and remote booking paths passed. Company pages now show online availability and delivery badges correctly.
17. **Provider Profile results** — Public slugs, ownership previews, service links, metadata privacy, sharing, portfolio controls, and trust wording passed existing coverage. Company screening now uses the same currentness rule.
18. **Privacy results** — Public/private route and source audits found no new exposure. Private addresses, account data, and administrative data remain server-authorized.
19. **Personal name visibility results** — The signed-in setting was OFF during the live audit. Server tests confirm public pages, metadata, JSON-LD, and APIs use business identity unless the owner explicitly opts in.
20. **API privacy results** — Public provider data does not return the private owner name when visibility is off. Administrative access remains separate.
21. **Search results** — Local/remote/all behavior, category relevance, radius controls, deduplication, Pro ranking, and service-request empty-state behavior passed automated coverage and production smoke tests.
22. **Mobile results** — No horizontal document overflow was detected on the homepage or focused marketplace, listing, company, and request pages at tested breakpoints. The 320-pixel visual pass showed compact search controls and consistent upcoming-category cards.
23. **iPhone Safari results** — Responsive CSS, safe-area rules, minimum input sizing, and mobile layout tests passed, but a real Safari/WebKit device was unavailable. Physical iPhone testing remains required.
24. **Dark mode results** — Mobile homepage dark mode was visually inspected: neutral surfaces, borders, icons, text, and CTA contrast were readable with no horizontal overflow. The original light preference was restored. Full route-by-route visual comparison remains manual.
25. **Accessibility results** — Existing tests cover headings, labels, focus, modal semantics, controls, keyboard-visible states, progress bars, and responsive touch targets. A formal screen-reader and WCAG contrast-tool pass remains recommended.
26. **SEO results** — Robots, sitemap, canonical/meta patterns, provider/listing/guide/location metadata, and private-route exclusion passed existing coverage and production route checks.
27. **Social preview results** — Listing, provider, partner, guide, and homepage preview generation is present; personal-name privacy remains server-enforced. External platform card previews were not re-scraped in this pass.
28. **Email results** — Branding, idempotency, booking updates, recurring reminders, partner qualification, and compensation-copy tests passed. Delivery-provider inbox rendering remains manual.
29. **Notification results** — Booking, quote, request, recurring, payout, dispute, and milestone notification idempotency passed existing tests.
30. **Admin results** — Admin, affiliates, expenses, operations, and request pages rendered in production. Server-side admin authorization and responsive table/dialog coverage passed.
31. **Authorization results** — Server ownership and role checks passed the full automated suite. No client-hidden-button rule is used as the sole authorization gate in the audited flows.
32. **Security results** — Production dependencies report 0 vulnerabilities; auth now fails closed without a production secret; DigitalOcean client IPs feed per-user auth limits; CSRF/origin checks, payload limits, secure headers, URL validation, and sensitive-action rate limits remain active. Five high advisories remain only in the ESLint development dependency chain; npm proposes an unsafe breaking downgrade, so it was not forced.
33. **Performance results** — The production build is clean and public profile/company queries avoid newly introduced N+1 work. No formal load, latency percentile, or database `EXPLAIN ANALYZE` test was run.
34. **Production data cleanup** — Public listings and companies were inspected; no obvious lorem ipsum, fake reviews, or demo cards were found. No records were deleted because uncertain production data must not be removed blindly.
35. **Legal internal wording removed** — No customer-facing legal-review/draft/developer wording was found in the audited application surfaces. Form placeholder attributes and internal screening code terms are functional, not public drafting notes.
36. **LEGAL ITEMS TO REVIEW** — Qualified counsel should still review Terms, Privacy, Provider Agreement, Partner Agreement, Cookie Notice, payout/refund language, screening descriptions, and data-retention obligations before relying on them as final legal advice.
37. **BUSINESS DECISIONS REQUIRED** — Confirm whether the $2.99 fee applies to every recurring occurrence and every future milestone payment; define the complete milestone-project product before launch; confirm trial/card/proration policy; and confirm whether custom-program edits must affect only future referrals (current behavior preserves existing snapshots).
38. **Manual verification still needed** — Real Stripe test-mode journeys, webhook replay, multi-account customer/provider/partner journeys, physical iPhone Safari, screen reader/contrast tooling, real email inbox rendering, load testing, database query plans, and production verification after deployment.
39. **Anything intentionally unchanged** — No live money, live Stripe records, production-data deletions, database migration, legal-policy rewrite, or incomplete milestone-project UI was fabricated. The single-booking detail route remains `/account/bookings/[bookingId]`; there is no linked `/account/bookings` index.
40. **Final overall production readiness rating** — **8.9/10 now**. The code and production UI are materially hardened, but calling it 10/10 before the remaining Stripe sandbox, Safari, email, load, and end-to-end multi-account checks would be inaccurate.

## Release gate

Before declaring 10/10, provision an isolated test database plus Stripe test-mode secrets and run the payment, refund, subscription, transfer/reversal, recurring, and Partner scenarios end to end. Then deploy this change set, confirm the Better Auth shared-bucket warning disappears from DigitalOcean logs, and complete the physical Safari/accessibility checks.
