import "server-only";

import type Stripe from "stripe";
import { isAtLeastEighteen } from "./age-eligibility";
import { database } from "./database";
import { getStripe, getStripeMode } from "./stripe";
import { markAffiliateListingPublished } from "./affiliates";
import { recordAnalytics } from "./analytics";

export type ProviderAgeVerificationStatus = "not_started" | "pending" | "requires_input" | "verified" | "failed";

type StoredProvider = {
  id: string;
  stripe_identity_verification_session_id: string | null;
  stripe_identity_verification_mode: "test" | "live" | null;
  age_verification_status: ProviderAgeVerificationStatus;
  age_verification_source: "stripe_identity" | "admin_exception" | null;
};

export function ageVerificationStatusForStripeSession(session: Stripe.Identity.VerificationSession): ProviderAgeVerificationStatus {
  if (session.status === "verified") return "verified";
  if (session.status === "processing") return "pending";
  if (session.status === "requires_input") return "requires_input";
  return "failed";
}

function dobFromVerifiedSession(session: Stripe.Identity.VerificationSession) {
  const dob = session.verified_outputs?.dob;
  if (!dob || !dob.year || !dob.month || !dob.day) return null;
  return `${String(dob.year).padStart(4, "0")}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;
}

async function setProviderAgeVerification(providerId: string, status: ProviderAgeVerificationStatus, failureCode: string | null = null) {
  if (status === "verified") {
    const provider = await database.query<{ user_id: string }>(`UPDATE provider_profiles
      SET age_verification_status='verified', age_identity_verified_at=now(), age_verification_failure_code=NULL,
        age_verification_source='stripe_identity'
      WHERE id::text=$1 RETURNING user_id`, [providerId]);
    // Only activate listings that this gate previously held back. Manually
    // deactivated listings remain inactive.
    const published = await database.query<{ id: string; category: string; delivery_type: string; city: string; state: string }>(`UPDATE services SET is_active=true, age_verification_blocked=false
      WHERE provider_id::text=$1 AND age_verification_blocked=true
      RETURNING id::text,category,delivery_type,city,state`, [providerId]);
    await markAffiliateListingPublished(providerId);
    const firstListing = published.rows[0];
    if (firstListing && provider.rows[0]?.user_id) {
      await recordAnalytics({ eventName: "first_listing_published", userId: provider.rows[0].user_id,
        targetType: "service", targetId: firstListing.id,
        metadata: { category: firstListing.category, deliveryType: firstListing.delivery_type,
          ...(firstListing.delivery_type === "REMOTE" ? {} : { city: firstListing.city, state: firstListing.state }) } });
    }
    return;
  }
  await database.query(`UPDATE provider_profiles
    SET age_verification_status=$2, age_identity_verified_at=NULL, age_verification_failure_code=$3,
      age_verification_source=NULL
    WHERE id::text=$1`, [providerId, status, failureCode]);
  await database.query(`UPDATE services SET is_active=false, age_verification_blocked=true
    WHERE provider_id::text=$1`, [providerId]);
}

/**
 * Reconciles one Stripe Identity session. Its verified DOB is used in memory
 * only to establish the 18+ result; it is never persisted or logged.
 */
export async function syncProviderAgeVerificationFromStripe(sessionId: string) {
  const mode = getStripeMode();
  const providerResult = await database.query<StoredProvider>(`SELECT id::text, stripe_identity_verification_session_id,
      stripe_identity_verification_mode, age_verification_status, age_verification_source
    FROM provider_profiles
    WHERE stripe_identity_verification_session_id=$1 AND stripe_identity_verification_mode=$2`, [sessionId, mode]);
  const provider = providerResult.rows[0];
  if (!provider) return null;
  if (provider.age_verification_source === "admin_exception") return "verified" as const;

  const session = await getStripe().identity.verificationSessions.retrieve(sessionId, { expand: ["verified_outputs"] });
  if (session.client_reference_id !== provider.id) return null;

  if (session.status === "verified") {
    const dob = dobFromVerifiedSession(session);
    if (dob && isAtLeastEighteen(dob)) {
      await setProviderAgeVerification(provider.id, "verified");
      return "verified" as const;
    }
    // A document that did not supply a usable DOB cannot establish eligibility.
    await setProviderAgeVerification(provider.id, "failed", "age_not_verified");
    return "failed" as const;
  }

  const status = ageVerificationStatusForStripeSession(session);
  await setProviderAgeVerification(provider.id, status, session.last_error?.code ?? null);
  return status;
}

export async function startProviderAgeVerification(input: { providerId: string; origin: string }) {
  const mode = getStripeMode();
  const providerResult = await database.query<StoredProvider>(`SELECT id::text, stripe_identity_verification_session_id,
      stripe_identity_verification_mode, age_verification_status, age_verification_source
    FROM provider_profiles WHERE id::text=$1`, [input.providerId]);
  const provider = providerResult.rows[0];
  if (!provider) throw new Error("PROVIDER_NOT_FOUND");
  if (provider.age_verification_status === "verified") return { status: "verified" as const, url: null };

  if (provider.stripe_identity_verification_session_id && provider.stripe_identity_verification_mode === mode) {
    const session = await getStripe().identity.verificationSessions.retrieve(provider.stripe_identity_verification_session_id, { expand: ["verified_outputs"] });
    if (session.client_reference_id === provider.id) {
      const status = await syncProviderAgeVerificationFromStripe(session.id);
      if (status === "verified") return { status, url: null };
      if (session.status === "requires_input" && session.url) return { status: "requires_input" as const, url: session.url };
      if (session.status === "processing") return { status: "pending" as const, url: null };
    }
  }

  const session = await getStripe().identity.verificationSessions.create({
    type: "document",
    client_reference_id: provider.id,
    return_url: `${input.origin}/provider/dashboard/billing?stripe=age-verification-return`,
    metadata: { providerId: provider.id, purpose: "provider_age_eligibility" },
    options: { document: { allowed_types: ["driving_license", "id_card", "passport"] } },
  // A retried, expired session needs a fresh Stripe URL. The previous session
  // ID makes that retry idempotent while concurrent first attempts share the
  // same initial key.
  }, { idempotencyKey: `provider-age-verification-${mode}-${provider.id}-${provider.stripe_identity_verification_session_id ?? "initial"}` });
  await database.query(`UPDATE provider_profiles
    SET stripe_identity_verification_session_id=$2, stripe_identity_verification_mode=$3,
        age_verification_status='requires_input', age_identity_verified_at=NULL, age_verification_failure_code=NULL,
        age_verification_source=NULL
    WHERE id::text=$1`, [provider.id, session.id, mode]);
  await database.query(`UPDATE services SET is_active=false, age_verification_blocked=true WHERE provider_id::text=$1`, [provider.id]);
  return { status: "requires_input" as const, url: session.url };
}
