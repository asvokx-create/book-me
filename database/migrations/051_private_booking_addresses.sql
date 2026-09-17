ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_address_line1 text,
  ADD COLUMN IF NOT EXISTS service_address_line2 text,
  ADD COLUMN IF NOT EXISTS service_city text,
  ADD COLUMN IF NOT EXISTS service_state text,
  ADD COLUMN IF NOT EXISTS service_postal_code text,
  ADD COLUMN IF NOT EXISTS access_instructions text NOT NULL DEFAULT '';

COMMENT ON COLUMN bookings.service_address IS 'Full formatted service address. Reveal to providers and assigned workers only after booking confirmation.';
COMMENT ON COLUMN bookings.access_instructions IS 'Private arrival, parking, gate, or building instructions for a confirmed booking.';
