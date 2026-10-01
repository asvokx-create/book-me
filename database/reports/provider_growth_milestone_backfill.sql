-- Read-only historical liability report. Review this output before approving any
-- existing partner's milestone_backfill_approved flag in the admin dashboard.
WITH qualified_provider_bookings AS (
  SELECT referral.affiliate_id, referral.provider_id,
    count(DISTINCT booking.id)::int AS qualified_booking_count
  FROM affiliate_referrals referral
  JOIN provider_profiles provider ON provider.id=referral.provider_id AND provider.is_active=true
  JOIN bookings booking ON booking.provider_id=referral.provider_id
  WHERE referral.status<>'disqualified'
    AND booking.status='completed' AND booking.payment_status='paid'
    AND booking.payment_release_status IN ('paid_out','partially_released')
    AND booking.payout_released_at IS NOT NULL
    AND booking.payout_released_at + make_interval(days => referral.hold_period_days) <= now()
    AND booking.refunded_amount_cents < booking.price_cents
    AND (booking.stripe_dispute_status IS NULL OR booking.stripe_dispute_status IN ('won','warning_closed'))
    AND NOT EXISTS (SELECT 1 FROM booking_disputes dispute WHERE dispute.booking_id=booking.id AND dispute.status IN ('open','reviewing'))
    AND NOT EXISTS (SELECT 1 FROM account_restrictions restriction WHERE restriction.user_id=provider.user_id
      AND restriction.status IN ('suspended','banned') AND (restriction.expires_at IS NULL OR restriction.expires_at>now()))
  GROUP BY referral.id, referral.affiliate_id, referral.provider_id
), active_counts AS (
  SELECT affiliate_id,count(*)::int AS active_provider_count
  FROM qualified_provider_bookings WHERE qualified_booking_count>=4 GROUP BY affiliate_id
)
SELECT affiliate.id::text AS affiliate_id,affiliate.display_name,affiliate.email,program.name AS program_name,
  COALESCE(active.active_provider_count,0) AS active_provider_count,
  COALESCE((SELECT sum(config.bonus_cents)::int FROM unnest(program.milestone_thresholds,program.milestone_bonus_cents)
    AS config(threshold,bonus_cents) WHERE config.threshold<=COALESCE(active.active_provider_count,0)),0) AS potential_historical_liability_cents,
  affiliate.milestone_backfill_approved
FROM affiliate_profiles affiliate
JOIN affiliate_programs program ON program.id=affiliate.program_id
LEFT JOIN active_counts active ON active.affiliate_id=affiliate.id
WHERE COALESCE(affiliate.milestone_bonuses_override,program.milestone_bonuses_enabled)=true
ORDER BY potential_historical_liability_cents DESC,affiliate.display_name;
