ALTER TABLE provider_profiles
  ALTER COLUMN no_show_policy SET DEFAULT
    'If you cannot attend, contact the other person as soon as possible. Repeated no-shows may be reported to BubsBookings.';

UPDATE provider_profiles
SET no_show_policy =
  'If you cannot attend, contact the other person as soon as possible. Repeated no-shows may be reported to BubsBookings.'
WHERE no_show_policy =
  'If you cannot attend, contact the other person as soon as possible. Repeated no-shows may be reported to BookMe.';
