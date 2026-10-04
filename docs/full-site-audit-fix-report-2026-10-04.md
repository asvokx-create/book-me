# BubsBookings full-site audit fix report

Date: October 4, 2026

## 1. Confirmed issues

- **Confirmed Issue:** no account-owner control existed for public personal-name visibility.
- **Confirmed Issue:** public company pages always rendered `Owned by {owner.name}`, including names supplied by Google sign-in.
- **Confirmed Issue:** the shared public provider loader returned the raw account-owner name even though the current provider-profile UI did not use it.
- These issues are fixed in this change. No unrelated marketplace systems were rebuilt.

## 2. Already fixed items

Provider Join SSR and local/remote copy; public dispute SSR; live Locations filtering; durable support routes; zero-result Service Request promotion; empty-category handling; truthful trust/payment wording; screening freshness; zero-metric suppression; BubsBookings branding; Guides terminology and CTAs; Partner SSR/social metadata; listing/provider metadata; Pro priority; consent-gated funnel analytics; referral-cookie disclosures; rendered Privacy numbering; account export/deletion; and public/private provider-data separation were already implemented and retained.

## 3. Product decisions

- Existing and new accounts default to personal-name visibility **OFF**.
- The business/company identity remains public.
- When the preference is ON, only a surface that intentionally supports owner attribution may show the personal name. The business name is not replaced.
- Google profile images remain unchanged. The request explicitly prioritized name privacy and did not require photo removal.
- Thin supply remains truthful; the product does not fabricate providers, counts, reviews, availability, popularity, or trends.

## 4. Items needing data

- Supply density and concentration are business metrics, not a code defect. Admin operations already exposes supply and demand by city, ZIP, and category.
- The conversion effect of Pro placement and zero-result Service Requests requires real production cohort data.

## 5. Manual verification items

- After deployment, toggle an older provider OFF→ON→OFF and inspect a company page from a signed-out browser.
- Re-run LinkedIn/Facebook/X external preview debuggers after deployment; BubsBookings will stop publishing the name immediately, but third-party preview caches are outside application control.
- Complete a fresh Google OAuth signup in staging to confirm the provider remains private by default.

## 6. Personal name privacy implementation

Account Settings now shows provider owners a **Show my personal name publicly** checkbox with visible ON/OFF text, explanatory copy, a real form label, keyboard operation, and a focus ring. The internal account name is unchanged.

## 7. Database/schema changes

`user_settings.public_personal_name_visible boolean NOT NULL DEFAULT false` stores the owner preference.

## 8. Migration behavior

Migration 074 uses `ADD COLUMN IF NOT EXISTS`, is safe to rerun, and gives existing rows and accounts without a settings row the privacy-protective `false` behavior. Public pages continue to use the business name, so URLs and provider identities remain valid.

## 9. Default visibility behavior

OFF for new and existing accounts. Missing values also resolve to OFF at every public query boundary.

## 10. Public profile changes

Provider pages, titles, descriptions, Open Graph data, JSON-LD, and share copy already use the business name. The loader now exposes only `publicOwnerName`, which is `null` when the setting is OFF.

## 11. Public API changes

The shared public provider/company data functions sanitize the owner name before returning it. Authenticated booking, admin, support, billing, and identity workflows keep their authorized internal access.

## 12. Google sign-in privacy findings

Google may populate the internal `user.name` and `user.image`. The name can no longer become public merely because it exists: the public query also requires the explicit visibility preference. The profile image behavior is intentionally unchanged.

## 13. Metadata and Open Graph privacy results

Service and provider metadata, structured data, share descriptions, and generated social images use service and business identities. No owner-name reference exists in these public metadata generators.

## 14. Cache invalidation behavior

Changing the preference invalidates homepage, marketplace, listing, provider, and company routes. Provider and company pages are request-time rendered, so fresh HTML no longer contains the hidden name.

## 15. Provider Join SSR results

**Already Fixed.** `/providers/join` server-renders meaningful acquisition copy, local/remote/both positioning, benefits, no-lead-fee messaging, pricing context, and CTAs. Production title, description, canonical, and content rendered successfully.

## 16. Dispute workflow results

**Already Fixed.** The signed-out page server-renders the reporting window, eligible concerns, evidence guidance, high-level review sequence, limitations, Terms link, and login CTA without exposing admin logic or promising outcomes.

## 17. Locations results

**Already Fixed.** `/locations` is request-time rendered, shows only cities backed by active in-person listings, has a correct canonical, contains no duplicate/fake city pages, and explains nationwide search without claiming remote work is local.

## 18. Support flow results

**Already Fixed.** Contact Support, Report a Bug, Disputes, Promise, footer links, authenticated support, and email fallback use durable internal routes. The production support page rendered real content and no dead route was found.

## 19. Zero-result search changes

**Already Fixed.** Zero results promote a prefilled Service Request, radius expansion, and demand capture without fake listings.

## 20. Empty category changes

**Already Fixed.** Active categories are separated from **More services coming soon** categories, which lead into demand capture. The 320px visual check showed compact, consistent category rows.

## 21. Trust language changes

**Already Fixed.** Public UI uses qualified terms such as Email confirmed, Business profile checked, and Profile screened. The Promise explicitly says it is not insurance or a workmanship guarantee.

## 22. Payment wording changes

**Already Fixed.** Public wording says Stripe-powered or processed through Stripe and does not claim guaranteed or absolute security.

## 23. Screening freshness results

**Already Fixed.** Verification is current only inside the configured freshness window. Material provider, service, location, delivery, description, portfolio, personal-name, and phone edits run or invalidate automated verification as appropriate.

## 24. Zero metric cleanup

**Already Fixed.** Empty photo/completion metrics are omitted; useful expectations such as New listing or No verified reviews yet remain.

## 25. Branding cleanup

**Already Fixed.** Public branding consistently uses BubsBookings and the accessible lockup. No public BookMe/BBubs duplicate branding was found.

## 26. Guide cleanup

**Already Fixed.** Customer-facing navigation and headings use Guides. Relevant articles contain restrained marketplace/provider/Partner CTAs.

## 27. Partner SSR/social results

**Already Fixed.** `/partners` is public, server-rendered, canonical, indexable, and has a complete title, description, Open Graph image, Twitter card, FAQ JSON-LD, local/remote positioning, terms, and CTA.

## 28. Listing social preview results

**Already Fixed and privacy-safe.** Listing title, service description, business identity, image/fallback image, Twitter card, canonical, and Service JSON-LD are generated without the personal owner name.

## 29. Provider social preview results

**Already Fixed and privacy-safe.** Provider previews and structured data use `businessName`, not the account name.

## 30. Pro priority placement verification

**Already Fixed.** Pro/Business/Owner listings receive priority inside 10-mile distance bands for default/nearest search. The band remains the primary key, then paid-plan priority, then exact distance, then deterministic title/id tie-breaks. Multiple Pro providers therefore compete by distance and stable tie-breaks rather than randomness.

## 31. Analytics/instrumentation findings

**Already Fixed.** Consent-gated browser events cover searches, zero-result searches, listing views, provider/company views, shares, and checkout abandonment. Server-side operational analytics cover message starts, Service Requests, quotes, booking starts, checkout starts, payments, completions, reviews, refunds, disputes, provider completion/first listing, and affiliate financial conversion records.

## 32. Cookie/Partner attribution findings

**Already Fixed.** Cookie and Privacy notices match the HTTP-only first-party referral cookie, configurable attribution window, code override, one-time locking, cookie clearing, and the fact that optional analytics consent does not disable necessary attribution.

## 33. Privacy Policy formatting changes

**Already Fixed in rendered output.** The page normalizes heading numbers by array position, producing one continuous 1–14 sequence. Links and current terminology passed the legal-page regression.

## 34. Authorization results

The control is returned only for an active provider owner. The update query changes the preference only when the authenticated user owns an active provider profile. Team members can still save their own ordinary account settings but cannot mutate the owner row. Every real preference change is logged.

## 35. Mobile results

The production baseline was visually and programmatically checked at 320, 375, 390, 430, 600, 768, 1024, 1366, 1920, and 3840 widths with no horizontal document overflow. The new control uses `min-w-0`, a nonshrinking switch/state label, mobile card padding, and wrapping copy.

## 36. Dark mode results

The setting uses the shared neutral dark surface, text, border, input, focus, and accent system. The authenticated settings toggle layout was visually checked in dark mode and restored to Light afterward.

## 37. Accessibility results

The setting is a native checkbox inside a label. Checked state is exposed to assistive technology, visible ON/OFF text does not rely on color, the switch has a keyboard focus outline, and the card has a labelled heading.

## 38. Tests added

`tests/public-name-privacy.test.ts` covers migration defaults, older and Google-derived names, owner-only persistence, sanitized public loaders, company rendering, metadata/structured-data business identity, accessibility, and route revalidation. Full result: 239/239 tests passed, lint passed, and the Next.js production build passed across 121 routes.

## 39. Files changed

- `app/account/settings/settings-form.tsx`
- `app/api/account/settings/route.ts`
- `app/companies/[slug]/page.tsx`
- `lib/companies.ts`
- `lib/marketplace.ts`
- `lib/public-provider-identity.ts`
- `database/migrations/074_public_personal_name_visibility.sql`
- `tests/public-name-privacy.test.ts`
- this report

## 40. Migrations

One additive migration: `074_public_personal_name_visibility.sql`. It does not rewrite names, business profiles, URLs, listings, or authentication records.

## 41. LEGAL ITEMS TO REVIEW

No customer-facing drafting labels remain. Counsel may independently review retention periods, jurisdiction-specific privacy-right procedures, Partner disclosures, and dispute/refund terms as the business changes; no new substantive legal promise was added here.

## 42. Anything intentionally unchanged

Internal personal names remain available to authorized account, admin, billing, Stripe, support, booking-assignment, and identity workflows. Google/profile photos remain public under the existing profile-photo behavior. Business names and stable business-derived slugs remain public. Supply, rankings, reviews, booking counts, and availability were not fabricated or manually boosted.
