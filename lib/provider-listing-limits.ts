import "server-only";

import type { PoolClient } from "pg";
import { getStripeMode } from "@/lib/stripe";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

export type ProviderListingLimit = {
  effectivePlan: ProviderPlan;
  listingCount: number;
  totalListingCount: number;
  serviceLimit: number | null;
  overLimit: boolean;
};

/**
 * Listings that are public or waiting on age verification occupy a plan slot.
 * Administrator-archived and provider-deleted records do not occupy a slot.
 */
export const LISTING_LIMIT_SQL_PREDICATE =
  "service.provider_deleted_at IS NULL AND (service.is_active = true OR service.age_verification_blocked = true)";

export function listingLimitExceeded(listingCount: number, serviceLimit: number | null) {
  return serviceLimit !== null && listingCount >= serviceLimit;
}

/**
 * Serializes listing creation and restoration for one provider. The provider row
 * remains locked until the caller commits or rolls back its transaction.
 */
export async function lockProviderListingLimit(
  client: PoolClient,
  providerId: string,
): Promise<ProviderListingLimit | null> {
  const mode = getStripeMode();
  const result = await client.query<{
    effective_plan: ProviderPlan;
    listing_count: number;
    total_listing_count: number;
  }>(
    `SELECT
       CASE
         WHEN provider.plan IN ('owner', 'business') THEN provider.plan
         WHEN EXISTS (
           SELECT 1 FROM complimentary_pro_grants complimentary
           WHERE complimentary.provider_id = provider.id
             AND complimentary.revoked_at IS NULL
             AND complimentary.starts_at <= now()
             AND (complimentary.expires_at IS NULL OR complimentary.expires_at > now())
         ) THEN 'pro'
         WHEN provider.stripe_subscription_id IS NOT NULL
           AND provider.stripe_billing_mode = $2
           AND provider.stripe_subscription_status IN ('active', 'trialing', 'past_due') THEN 'pro'
         ELSE 'starter'
       END AS effective_plan,
       (SELECT count(*)::int
        FROM services service
        WHERE service.provider_id = provider.id
          AND ${LISTING_LIMIT_SQL_PREDICATE}) AS listing_count,
       (SELECT count(*)::int FROM services service WHERE service.provider_id = provider.id) AS total_listing_count
     FROM provider_profiles provider
     WHERE provider.id::text = $1
     FOR UPDATE OF provider`,
    [providerId, mode],
  );
  const row = result.rows[0];
  if (!row) return null;
  const serviceLimit = PLAN_ENTITLEMENTS[row.effective_plan].serviceLimit;
  return {
    effectivePlan: row.effective_plan,
    listingCount: row.listing_count,
    totalListingCount: row.total_listing_count,
    serviceLimit,
    overLimit: serviceLimit !== null && row.listing_count > serviceLimit,
  };
}
