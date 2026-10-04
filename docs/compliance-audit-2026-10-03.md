# BubsBookings pre-growth compliance audit

**Audit date:** October 3, 2026  
**Scope:** Current repository implementation plus a read-only production UI inspection of public homepage, discovery, policy, pricing, provider, partner, support, and trust surfaces. Authenticated implementation was reviewed in source and tests. This is a product/compliance audit, not a legal opinion or accessibility certification.

## Executive result

The product already has unusually strong plain-language marketplace, payment, trust-label, review, location, automated-screening, affiliate, deletion, and content-removal disclosures. The audit found and fixed three concrete gaps:

1. Optional first-party browser analytics and Google Analytics previously ran without an on-site choice. They are now off by default until a visitor affirmatively allows them, with an equal “Continue without analytics” option and a persistent footer control.
2. Partner applications referred to the Partner Agreement but did not require or preserve explicit acceptance. The form, API validation, timestamp, and agreement-version record are now explicit.
3. A business-branded listing could display a link to a different account-level provider brand. Business names now link to the matching company page first, with the provider profile retained only as a fallback.

One keyboard-accessibility gap was also improved: the reusable support dialog now receives focus, traps Tab, closes with Escape when safe, restores focus, and prevents background scrolling. Other dialogs are documented below as a remaining manual remediation item rather than being described as fully compliant.

## Classification matrix — all 40 requested areas

### 1. Privacy Policy — **NEEDS PRIVACY FIX → FIXED; NEEDS LEGAL REVIEW remains**

- Already correct: describes account, provider, customer, general and browser-derived location, private addresses, Stripe, partner applications, attribution, commission records, cookies, email, UGC, images, reviews, support, disputes, deletion, retention, processors, security, rights, and children.
- Fixed: optional browser analytics and Google Analytics are now accurately described as off until allowed, with a footer choice to change the decision. Operational account/booking/payment records are expressly distinguished from this browser choice.
- Legal review: confirm jurisdiction-specific privacy notices, controller/legal-entity identity, retention periods, state appeal wording, and whether Washington My Health My Data creates any obligations despite the product prohibition on health services/data.

### 2. Terms of Service — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Matches requests, quotes, direct bookings, remote/in-person work, completion, Stripe charges/transfers, fees, refunds, chargebacks, reviews, profiles, UGC, partners, suspension, deletion, age 18, and U.S. scope.
- Legal review: Washington governing-law/forum language, disclaimer/liability limitations, electronic assent, automatic renewal disclosures, and enforceability against each user class.

### 3. Refund policy — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Terms, dispute page, booking workflow, transfer release, refund route, and affiliate ledger consistently distinguish automatic eligible pre-transfer refunds from reviewed late/partial/transferred cases.
- The 48-hour customer completion-review window and payout freeze are consistently described.
- No unconditional refund promise was found.
- Legal review: cancellation/refund rights that cannot be waived in particular states or service categories.

### 4. Cookie Notice — **NEEDS COPY UPDATE → FIXED**

- Inventory matches authentication/security storage, theme/time-zone/location preferences, post-login state, first-party HTTP-only affiliate attribution, optional first-party analytics identifier, and optional GA `_ga` cookies.
- Copy now distinguishes optional analytics from necessary/preferences/referral storage and explains deletion behavior.

### 5. Cookie consent — **NEEDS PRIVACY FIX → FIXED; NEEDS LEGAL REVIEW remains**

- Previously, GA loaded on every page and first-party browser analytics created an identifier without an on-site choice.
- Now both optional browser analytics systems are blocked until “Allow analytics.” Declining removes the local analytics identifier and accessible GA cookies. The choice can be reopened from the footer.
- Sign-in, security, preferences, and deliberately initiated affiliate attribution remain available.
- Legal review: exact consent/geolocation rules by jurisdiction, geo-targeting strategy if the business later serves people outside the U.S., consent-log retention, and whether Global Privacy Control must be mapped to future covered processing.

### 6. Form consents — **NEEDS PRODUCT FIX → FIXED**

- Signup has separate, unchecked age/Terms, Privacy/AI, and related acknowledgments; no prechecked marketing consent was found.
- Provider onboarding requires Provider Agreement acceptance.
- Partner application now requires an unchecked Partner Agreement box and the server rejects missing acceptance; timestamp and version are stored.
- Checkout uses Stripe-hosted payment consent. Support forms warn against passwords/card data.
- No newsletter signup or promotional marketing form exists.

### 7. Data minimization — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Phone is optional for ordinary accounts; remote-only customers may defer general location; exact device coordinates are used transiently and not saved to the account; remote services do not require a street address.
- Street address and arrival instructions are withheld from opportunity views and become available only to the booked provider/assigned workers.
- Stripe, not BubsBookings forms, collects payment credentials, bank, identity, and tax data.
- Legal review: whether precise booking addresses, messages, and screening/audit logs need fixed retention schedules rather than purpose-based language.

### 8. Third-party SDK/service inventory — **ALREADY CORRECT**

| Service/library | Purpose | Data/identifier exposure | Result |
|---|---|---|---|
| Stripe / Stripe Connect | Checkout, subscriptions, refunds, disputes, connected payouts, identity/tax readiness | Transaction, billing, risk, connected-account and payout data; Stripe-hosted credentials | Disclosed; credentials remain Stripe-hosted |
| Google OAuth | Optional sign-in | Google account profile/email according to the OAuth grant | Disclosed |
| Google Analytics 4 | Optional browser traffic/product measurement | GA client identifier, page/event, device/browser, referrer, IP-derived approximate location | Now consent-gated |
| Resend | Transactional email delivery | Recipient, subject/body, delivery status/provider message ID | Disclosed as email-delivery processor |
| DigitalOcean App Platform / PostgreSQL / Spaces-compatible object storage | Hosting, database, uploaded images | Application records, logs, provider-uploaded images | Disclosed by functional category; name should be added if counsel/business chooses a named subprocessor list |
| Better Auth | Self-hosted authentication framework | Account/session/OAuth data in BubsBookings infrastructure | No separate third-party hosted processor identified |
| `next/font` Manrope | Build-time font bundling | No runtime Google Fonts request expected | Licensed package; no visitor tracking |
| QR code / internal icon components | Local rendering | No social SDK or outbound tracking SDK | No issue |

No map SDK, social sharing SDK, newsletter platform, third-party generative-AI API, or error-tracking SDK was found. Social share links are ordinary outbound URLs.

### 9. Dark patterns — **ALREADY CORRECT**

- Account deletion and billing cancellation are discoverable in settings/billing.
- Trial conversion, card requirement, renewal price, booking fees, and service fee are repeatedly disclosed.
- No fake countdown, inventory scarcity, forced paid upgrade, preselected paid option, or bundled marketing consent was found.
- Analytics choices use two ordinary buttons rather than an emphasized accept-only pattern.

### 10. Hidden fees — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Public pricing and guides consistently show Starter $0/month + 10% provider fee, Pro $9.99/month + 6% fee, 30-day eligible trial conversion, and the separate $2.99 customer service fee before payment.
- Requests, messages, opportunities, and quotes are accurately described as free.
- Internal Business/Owner plan definitions exist but are not purchasable public offers; they should remain out of public claims unless launched.
- Legal review: tax disclosure/calculation obligations and state automatic-renewal presentation requirements.

### 11. Fake reviews — **ALREADY CORRECT**

- Review creation requires the authenticated booking customer, a completed booking, one review per booking, bounded rating/body, and safety screening.
- Empty state says “No verified reviews yet”; 0.0-star placeholder ratings were not found.
- No seed reviews, AI testimonials, or placeholder endorsements were found.

### 12. Unsupported claims — **NEEDS COPY/PRODUCT FIX → FIXED where concrete; NEEDS LEGAL REVIEW remains**

- Existing copy repeatedly explains that screening is not a background, identity, license, insurance, quality, or safety guarantee; bookings and partner earnings are not guaranteed.
- Payment wording is “through/powered by Stripe,” not “guaranteed secure.” Promise page expressly disclaims insurance/workmanship guarantee.
- Fixed misleading business-profile destination so a business-branded service does not point at a different public brand.
- Legal review: “safer conversations,” “more confidence,” and similar comparative marketing language before paid advertising at scale.

### 13. Alt text and icon semantics — **ALREADY CORRECT**

- Logos have one accessible BubsBookings name; decorative logo art is ignored.
- Homepage listing photos use service-title cover text; generated decorative art receives an equivalent role/name only when no image exists.
- Portfolio supports provider-supplied alt text with caption/business fallbacks.
- Production DOM check found zero `<img>` elements missing an `alt` attribute on the audited homepage.
- Icon buttons inspected have accessible names; decorative icons beside visible text are hidden or do not replace the visible label.

### 14. Color contrast — **ALREADY CORRECT for inspected samples; NEEDS ACCESSIBILITY REVIEW**

- Global light/dark focus tokens and explicit dark-mode component overrides exist, and prior responsive/dark-mode regression tests cover major surfaces.
- Public homepage was visually inspected at mobile and desktop sizes with readable text, controls, borders, and badges.
- This is not a WCAG certification. A calibrated automated contrast scan plus manual review of every authenticated state, placeholder, error, disabled, hover, and focus color remains recommended.

### 15. Keyboard navigation — **NEEDS ACCESSIBILITY FIX (partly fixed)**

- Already correct: skip link, semantic header/nav, labels, global visible focus, accessible mobile navigation, calendar keyboard handling, and several dialogs with Escape/focus trapping.
- Fixed: support dialog now handles initial focus, Tab containment, Escape, background lock, and focus restoration.
- Remaining: several one-off admin, booking cancel/reschedule/quote, bug-report, message-report, listing-delete, photo-viewer, and city-selector dialogs need the same full manual focus-cycle verification and, where missing, the shared dialog behavior.
- No claim of “fully keyboard accessible” is made.

### 16. Business details — **NEEDS LEGAL REVIEW**

- BubsBookings brand name and a functioning support/privacy/legal email are public; no private home address is exposed.
- Counsel/business must determine the correct legal entity name, registered/mailing address, statutory notices, and whether they must appear in Terms, invoices, email footer, or state registrations. Do not publish a personal address by guesswork.

### 17. Age/minor consistency — **NEEDS COPY UPDATE → FIXED**

- Terms, Privacy, signup, and Provider Agreement consistently require age 18.
- Partner Agreement now explicitly requires applicants to be at least 18 and legally able to contract.
- No child-directed account/content flow was found.

### 18. Email unsubscribe — **NOT APPLICABLE to current email set; ALREADY CORRECT**

- Current email code is limited to authentication, booking lifecycle, messages, opportunities, provider onboarding/success, partner milestones, trial reminders, and other account/transaction events.
- No newsletter, bulk promotional campaign, or automated marketing sequence was found.
- Notification preferences already control applicable operational notices. Do not add marketing-unsubscribe copy to password/security messages.
- If promotional email is introduced, separate consent, sender identity/address, preference and unsubscribe handling need implementation before launch.

### 19. Licensed fonts, images, icons, content — **ALREADY CORRECT; NEEDS LEGAL REVIEW for provenance records**

- Manrope is bundled through the framework; icons/illustrations are repository-native code, Unicode, or provider uploads. No obvious unlicensed stock bundle was found.
- Terms and Provider Agreement require upload rights and only grant an operational/promotional license while leaving ownership with uploaders.
- Legal/operations should retain license/provenance records for future campaign art and confirm any externally commissioned assets.

### 20. Data deletion/account closure — **ALREADY CORRECT operationally; NEEDS LEGAL REVIEW**

- Deletion requires an authenticated session, same-origin request, rate limit, and exact account-email confirmation.
- Active bookings, open disputes, and unsettled payments block deletion; linked subscriptions/customers/connect accounts and stored images are addressed before database deletion.
- Public profile/listings and login account are removed; partner financial/audit history may remain detached as disclosed.
- Legal review: the implementation currently deletes settled booking/payment-linked marketplace records after blockers clear. Counsel/accounting must specify records that must be retained, for how long, and how they should be deidentified/restricted rather than destroyed.

### 21. Provider claims — **ALREADY CORRECT**

- Provider-supplied experience, specialties, languages, portfolio, and business history are presented as profile content, not as BubsBookings verification.
- Agreements make providers responsible for licenses, insurance, permits, certifications, and accuracy.
- No automatic “licensed,” “insured,” or “background checked” badge was found.

### 22. Provider verification language — **ALREADY CORRECT**

- “Profile screened,” “Email confirmed,” and “Business profile checked” have contextual explanations.
- Public copy expressly states the checks do not verify criminal history, license, insurance, credentials, service quality, or phone ownership.
- Stripe identity/payout readiness is separately attributed to Stripe.

### 23. Remote versus in-person — **ALREADY CORRECT**

- Discovery, listings, requests, quotes, bookings, location settings, onboarding, SEO, emails, and policies distinguish Remote / In person / Both.
- Remote flows bypass radius/address requirements; in-person flows retain service-area and private-address handling.

### 24. Service-provider responsibility — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Provider Agreement assigns responsibility for quality, licenses, permits, insurance, taxes, workers, safety, customer data, work product, and lawful performance.
- Legal review: third-party claim/cooperation language and any state/category-specific insurance or licensing requirements.

### 25. Marketplace role — **ALREADY CORRECT**

- Terms/Promise/Provider Agreement state BubsBookings is a marketplace, not the service provider, employer, agent, insurer, background-check company, bank, trust, or escrow provider.
- Stripe architecture is accurately described as platform charge plus later separate transfer.

### 26. Stripe/payment language — **ALREADY CORRECT**

- Uses “processed through” / “powered by Stripe” and factual hosted/onboarding language.
- No guarantee of security, payout timing, refund timing, or fund availability was found.
- “Secured” is used internally as a payment state; public explanations avoid calling it escrow.

### 27. Refunds, disputes, chargebacks — **ALREADY CORRECT**

- Customer/provider/admin/ledger states line up: eligible refunds, transfer reversal/offset, dispute freezes, chargeback restrictions, and affiliate reversals preserve history.
- Partner earnings synchronize only after successful provider payout and remain reversible for qualifying downstream events.

### 28. User-generated content — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Bios, portfolio, listings, messages, reviews, booking text, reports, and support are covered by safety rules and a public no-account content-removal channel.
- Users keep ownership; the stated license is limited to operating, securing, improving, and promoting BubsBookings.
- Legal review: scope/duration of promotional use and notice/counter-notice agent/process before relying on DMCA safe-harbor procedures.

### 29. Provider portfolio rights — **ALREADY CORRECT**

- Provider controls upload, captions, alt text, order, and removal; admin may hide content during moderation.
- Copy does not claim BubsBookings owns provider work. Provider must have rights and customer/property permission.

### 30. Review moderation — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Verified-review criterion is completed BubsBookings booking; one review per booking.
- Safety moderation, reports, admin visibility controls, and provider dispute/support routes exist.
- No pay-to-remove mechanism or review incentive was found.
- Legal review: formal written moderation/appeal standards and recordkeeping under the FTC Consumer Reviews and Testimonials Rule as volume grows.

### 31. Affiliate/partner disclosure — **PUBLIC LABEL FIXED; NEEDS LEGAL REVIEW**

- Public page, agreement, dashboard, examples, custom terms, activation, share basis, duration, hold, minimum, milestones, campaign payments, tax/payout readiness, reversals, and non-guarantee language are explicit.
- Partner Agreement requires clear/conspicuous compensated-relationship disclosure near each promotion.
- Fixed: the internal growth-milestone legal-review label and internal review sentence were removed from the public Partner Agreement while preserving the substantive milestone terms.
- Legal review: counsel should still review growth-milestone terms, compensation advertising, and contractor/tax classification before paid promotion expands.

### 32. Affiliate tracking cookie — **ALREADY CORRECT**

- First-party, random, HTTP-only, Secure in production, SameSite=Lax, program-duration Max-Age.
- Active-partner validation, single-use token, attribution lock on provider creation, manual code override, self-referral prevention, and clearing after successful lock match the notice.
- It remains separate from optional analytics because it is created only after a deliberate partner-link visit and is needed to honor the referral relationship.

### 33. Custom partner compensation — **ALREADY CORRECT**

- Program and per-partner flags control activation, revenue, milestones, and custom campaigns independently.
- Referral terms are snapshotted; later edits do not silently rewrite existing referrals/ledger.
- Dashboard hides excluded rewards; admin must select an enabled program during approval.

### 34. Suspension and termination — **ALREADY CORRECT; NEEDS LEGAL REVIEW**

- Customer/provider/partner/listing status controls affect public visibility and future activity while preserving payment, dispute, reversal, and audit obligations.
- Agreements describe reasonable enforcement grounds and survival of financial/dispute duties.
- Legal review: notice and appeal expectations for adverse platform decisions in each served jurisdiction.

### 35. Location privacy — **ALREADY CORRECT**

- Public surfaces show general city/state/service area, not private street address or GPS coordinates.
- Browser coordinates are permission-based and transient; account stores a confirmed general area.
- Opportunities reveal city/ZIP/schedule; full address appears only after booking to the provider/assigned professionals. Remote work does not require it.

### 36. Email content — **ALREADY CORRECT**

- Templates use escaped content, absolute internal action URLs, delivery logging/idempotency where important, and “never ask for your password” safety text.
- Pricing, 48-hour review, payment-through-Stripe, provider payout, opportunity, and affiliate milestone language match product rules.
- No false scarcity or misleading urgency was found.

### 37. Security/authorization — **ALREADY CORRECT for focused static review; NEEDS SECURITY REVIEW**

- Sensitive routes use authenticated session, admin access, provider ownership/access, participant checks, signed Stripe webhooks, or constant-time cron-secret validation.
- The only routes without those guards are intentionally public: auth handler, health, city lookup, public listing availability, partner application (rate-limited), and affiliate attribution (validated/rate-limited by its flow).
- Account deletion adds same-origin validation, confirmation, rate limiting, blockers, and transactional cleanup.
- Uploads and public records are scoped in queries; private address and partner earnings are not returned by public listing APIs.
- Remaining: independent penetration testing, dependency/SAST scanning, production header/TLS review, secret rotation procedure, backup/restore test, incident-response runbook, and access-log review. This audit did not print or inspect production secrets.

### 38. Policy consistency — **NEEDS COPY UPDATE → FIXED; NEEDS LEGAL REVIEW remains**

- Privacy/Cookie mismatch about analytics was corrected.
- Terms, Provider Agreement, Partner Agreement, Promise, AI & Safety, Accessibility, Content Removal, and dispute behavior otherwise use consistent marketplace/non-guarantee/payment language.
- Provider Agreement uses a separate effective date from the shared policy constant; counsel should decide versioning/re-consent rules for each agreement.

### 39. Internal legal notes — **PUBLIC CLEANUP FIXED; NEEDS LEGAL REVIEW**

- The public heading “Provider Growth Milestones — NEEDS LEGAL REVIEW” and its internal review sentence were removed from the customer-facing Partner Agreement.
- A regression test now scans every public policy page for the prohibited drafting labels. Substantive unresolved questions remain documented here for counsel instead of being displayed to customers.

### 40. Final user experience — **ALREADY CORRECT with listed follow-ups**

- A normal visitor can identify the marketplace role, independent provider, fees, Stripe flow, completion/refund/dispute process, limited checks, data use, account deletion, and support path.
- Fixed the clearest brand-destination mismatch and optional analytics choice.
- Remaining UX work: finish uniform modal keyboard handling and obtain counsel-approved legal entity/contact/retention decisions.

## Production UI verification

- Public homepage semantics exposed one H1 followed by logical H2/H3 structure, labeled search/delivery/location/radius controls, labeled favorite buttons, policy navigation, and a skip link.
- Responsive overrides tested at 320, 360, 390, 430, 600, 768, 1024, and 1366 CSS-width targets showed no horizontal page overflow in the inspected public page.
- “More services coming soon” cards stayed equal height with stable labels/icons in the inspected layouts.
- Homepage DOM inspection found no unlabeled buttons and no `<img>` missing `alt`. The only sub-24px focusable measurements were duplicate inline listing-title links inside larger linked cards; the primary card links and favorite controls remain larger targets.
- Live production still reflects the previously deployed build; fixes in this audit require normal deployment before production re-verification.

## External standards and primary references

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C summary of WCAG 2.2 additions: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- FTC endorsements and affiliate disclosures: https://www.ftc.gov/news-events/topics/truth-advertising/advertisement-endorsements
- FTC review-platform guidance: https://www.ftc.gov/business-guidance/resources/featuring-online-customer-reviews-guide-platforms
- FTC Consumer Reviews and Testimonials Rule Q&A: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- FTC Consumer Review Fairness Act guidance: https://www.ftc.gov/business-guidance/resources/consumer-review-fairness-act-what-businesses-need-know
- Google Analytics default collection: https://support.google.com/analytics/answer/11593727
- Google Analytics cookie usage: https://support.google.com/analytics/answer/11397207
- Google Analytics privacy controls/consent responsibility: https://support.google.com/analytics/answer/6004245
- Stripe Privacy Center: https://stripe.com/in/legal/privacy-center
- Washington My Health My Data Act: https://app.leg.wa.gov/RCW/default.aspx?cite=19.373
- FTC Negative Option Rule docket/current status: https://www.ftc.gov/legal-library/browse/rules/negative-option-rule

## Files changed in this audit

- `components/analytics-consent.tsx` — consent state, neutral banner, deletion, and reusable footer choice.
- `components/google-analytics.tsx` — block GA until opt-in.
- `components/analytics-tracker.tsx`, `components/search-results-analytics.tsx`, `components/listing-share-button.tsx`, `components/booking-details.tsx` — gate optional first-party event tracking.
- `app/layout.tsx`, `components/site-footer.tsx` — render the choice manager and persistent control.
- `app/cookies/page.tsx`, `app/privacy/page.tsx` — match actual consent behavior.
- `components/partner-application-form.tsx`, `app/api/affiliates/apply/route.ts`, `database/migrations/069_partner_application_consent.sql` — explicit, enforced, recorded Partner Agreement acceptance.
- `app/partner-agreement/page.tsx` — explicit age-18 partner eligibility and removal of public internal drafting labels.
- `app/page.tsx`, `app/services/page.tsx`, `app/services/[slug]/page.tsx` — business-name destination integrity.
- `components/use-modal-accessibility.ts`, `components/contact-support-button.tsx` — shared keyboard-dialog behavior and first adoption.
- `tests/legal-pages.test.ts`, `tests/targeted-marketplace-audit.test.ts` — consent, agreement, age, and business-link regressions.

## Tests added/updated

- Analytics stays off until allowed across GA and all client event entry points.
- Declining analytics removes first-party analytics/GA identifiers.
- Choice text keeps necessary storage and referral attribution distinct.
- Footer offers persistent cookie choices.
- Partner application requires and records versioned agreement acceptance.
- Partner Agreement contains adult eligibility.
- Public policy pages reject internal legal-drafting labels.
- Business names prefer matching company destinations.

## Items intentionally unchanged

- Affiliate attribution was not tied to analytics consent because it is a first-party, purpose-specific record created after a user follows a partner link and is needed to honor the referral; it remains deletable before signup through browser controls.
- No marketing unsubscribe system was added because no marketing-email system exists.
- No sale/targeted-advertising opt-out was added because the product says and code indicates those activities are not used.
- No legal entity/address was invented or a private address published.
- No absolute refund, safety, review, income, payment-security, or accessibility guarantee was added.
- Financial/history deletion rules were not guessed; retention is a counsel/accounting decision.
- The milestone policy itself was not rewritten; only the internal drafting label and internal review sentence were removed from public display.

## Required pre-growth follow-up

1. **Counsel:** approve entity/contact disclosures, retention schedule, auto-renewal presentation, Partner milestones/compensation, governing law, limitations, UGC/DMCA process, state privacy, review moderation, and suspension/appeal standards.
2. **Accessibility:** complete authenticated manual keyboard/screen-reader/contrast testing and apply the shared dialog behavior to every remaining one-off modal.
3. **Security:** commission an independent penetration test and production configuration review; document incident response, backup restore, and access review.
4. **Operations:** maintain a named subprocessor list and asset-license/provenance register; document review/moderation and privacy-request SLAs.
5. **Deployment verification:** after release, confirm the consent banner blocks `_ga`, GA network requests, and `/api/analytics` until opt-in, and confirm business links resolve to the matching public company.
