-- Keep the public business address imported from Google Places separate from
-- free-form research notes so administrators can review and save it directly.
ALTER TABLE provider_outreach_prospects
  ADD COLUMN IF NOT EXISTS public_address text
  CHECK (public_address IS NULL OR char_length(btrim(public_address)) <= 300);
