import "server-only";

import { database } from "./database";
import { scanContent } from "./content-safety";
import { getStripe, getStripeMode } from "./stripe";

export type AutomatedProviderVerification = {
  providerId: string;
  checkedAt: string;
  overall: "passed" | "needs_changes";
  score: number;
  checks: Array<{
    key: "account" | "phone" | "identity" | "business";
    label: string;
    passed: boolean;
    verifiedBy: "bubsbookings" | "stripe";
    detail: string;
  }>;
};

const placeholderPattern = /\b(?:asdf|fake|sample|test business|test listing|do not book)\b/i;

function normalizedPhone(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export async function runAutomatedProviderVerification(providerId: string): Promise<AutomatedProviderVerification | null> {
  const providerResult = await database.query<{
    id: string;
    user_id: string;
    business_name: string;
    bio: string;
    phone: string | null;
    city: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
    is_active: boolean;
    stripe_account_id: string | null;
    stripe_connect_mode: "test" | "live" | null;
    stripe_identity_verified: boolean;
    user_name: string;
    user_phone: string;
    email_verified: boolean;
    terms_accepted_at: string | null;
    privacy_acknowledged_at: string | null;
    ai_safety_acknowledged_at: string | null;
  }>(`SELECT p.id::text, p.user_id, p.business_name, p.bio, p.phone, p.city, p.state,
      p.latitude, p.longitude, p.is_active, p.stripe_account_id, p.stripe_connect_mode,
      p.identity_verified AS stripe_identity_verified, u.name AS user_name, u.phone AS user_phone,
      u."emailVerified" AS email_verified, u.terms_accepted_at, u.privacy_acknowledged_at,
      u.ai_safety_acknowledged_at
    FROM provider_profiles p JOIN "user" u ON u.id = p.user_id
    WHERE p.id::text = $1`, [providerId]);
  const provider = providerResult.rows[0];
  if (!provider) return null;

  const servicesResult = await database.query<{
    title: string;
    business_name: string;
    category: string;
    description: string;
    price_cents: number;
    duration_minutes: number;
    is_active: boolean;
  }>(`SELECT title, business_name, category, description, price_cents, duration_minutes, is_active
    FROM services WHERE provider_id::text = $1`, [providerId]);
  const activeServices = servicesResult.rows.filter((service) => service.is_active);

  const accountPassed = provider.is_active && provider.email_verified && provider.user_name.trim().length >= 2
    && Boolean(provider.terms_accepted_at && provider.privacy_acknowledged_at && provider.ai_safety_acknowledged_at);

  const profilePhone = normalizedPhone(provider.phone);
  const accountPhone = normalizedPhone(provider.user_phone);
  const phonePassed = profilePhone.length >= 10 && profilePhone.length <= 15 && profilePhone === accountPhone;

  const businessText = [provider.business_name, provider.bio, provider.city, provider.state,
    ...activeServices.flatMap((service) => [service.title, service.business_name, service.category, service.description])].join(" ");
  const contentSafety = scanContent(businessText);
  const servicesComplete = activeServices.length > 0 && activeServices.every((service) =>
    service.title.trim().length >= 2 && service.business_name.trim().length >= 2
    && service.description.trim().length >= 30 && service.price_cents > 0 && service.duration_minutes > 0);
  const businessPassed = provider.business_name.trim().length >= 2
    && provider.bio.trim().length >= 30
    && Boolean(provider.city.trim() && provider.state.trim() && provider.latitude !== null && provider.longitude !== null)
    && servicesComplete && contentSafety.allowed && !placeholderPattern.test(businessText);

  let identityPassed = false;
  let identityDetail = "Complete Stripe payout onboarding so Stripe can verify the account representative.";
  if (provider.stripe_account_id && provider.stripe_connect_mode === getStripeMode() && process.env.STRIPE_SECRET_KEY) {
    try {
      const account = await getStripe().accounts.retrieve(provider.stripe_account_id);
      identityPassed = Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled
        && !account.requirements?.disabled_reason && !(account.requirements?.past_due?.length));
      identityDetail = identityPassed
        ? "Stripe payout onboarding and required identity details are complete."
        : "Stripe still needs information or review before identity and payouts are ready.";
      await database.query(`UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3
        WHERE id::text = $1`, [providerId, account.charges_enabled, account.payouts_enabled]);
    } catch (error) {
      console.error("Automated Stripe identity check failed", providerId, error);
      identityPassed = provider.stripe_identity_verified;
      identityDetail = "Stripe could not be reached; the previous verified status was preserved.";
    }
  }

  const checks: AutomatedProviderVerification["checks"] = [
    { key: "account", label: "Account verified", passed: accountPassed, verifiedBy: "bubsbookings", detail: accountPassed ? "Email, age/policy agreements, profile name, and account status passed." : "Verify the email and complete all required account agreements and profile details." },
    { key: "phone", label: "Phone details checked", passed: phonePassed, verifiedBy: "bubsbookings", detail: phonePassed ? "The account and provider profile contain the same validly formatted phone number. This does not prove ownership by SMS." : "Add one valid phone number to both the account and provider profile." },
    { key: "identity", label: "Stripe identity verified", passed: identityPassed, verifiedBy: "stripe", detail: identityDetail },
    { key: "business", label: "Business profile checked", passed: businessPassed, verifiedBy: "bubsbookings", detail: businessPassed ? "Active listings, business details, location, pricing, and safety rules passed." : "Complete the business profile and active listings, then remove placeholder or unsafe content." },
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const overall = passedCount === checks.length ? "passed" : "needs_changes";
  const checkedAt = new Date().toISOString();

  await database.query(`UPDATE provider_profiles SET
      phone_verified = $2, identity_verified = $3, business_verified = $4,
      screening_status = $5, screening_score = $6, screening_summary = $7,
      screening_checked_at = $8::timestamptz
    WHERE id::text = $1`, [providerId, phonePassed, identityPassed, businessPassed, overall, score,
    overall === "passed" ? "Automated account, phone-detail, Stripe identity, and business-profile checks passed."
      : checks.filter((check) => !check.passed).map((check) => check.detail).join(" "), checkedAt]);

  await database.query(`INSERT INTO provider_verification_checks (provider_id, overall_status, score, results)
    VALUES ($1::uuid, $2, $3, $4::jsonb)`, [providerId, overall, score, JSON.stringify(checks)]);

  for (const check of checks.filter((item) => item.key !== "account")) {
    await database.query(`UPDATE provider_verification_requests SET status = $3, admin_note = $4, details = '{}'::jsonb
      WHERE provider_id::text = $1 AND verification_type = $2 AND status = 'pending'`,
    [providerId, check.key, check.passed ? "approved" : "needs_changes", check.detail]);
  }

  return { providerId, checkedAt, overall, score, checks };
}
