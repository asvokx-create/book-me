# Provider outreach email setup

The Provider Outreach CRM only sends an email after an administrator creates and approves its specific draft, then presses **Send email**. It does not perform bulk or automatic sends.

## Production configuration

Configure these variables in the BubsBookings production environment:

- `RESEND_API_KEY` or `RESEND_MARKETING_API_KEY`: a server-only Resend key.
- `OUTREACH_EMAIL_FROM="BubsBookings <christian@bubsbookings.com>"`: this sender must be verified in Resend and align with the BubsBookings sending domain.
- `OUTREACH_POSTAL_ADDRESS`: BubsBookings' real, valid mailing address. This can be a qualifying post-office box or private mailbox; do not use a made-up address.
- `OUTREACH_TOKEN_SECRET`: a new, long random secret used solely to sign unsubscribe links.

The send control stays disabled until every prerequisite is present. Resend will also reject the request if the domain or sender has not been verified.

## Safeguards

- A prospect needs a reviewed public email and cannot be on the permanent suppression list.
- A draft must be explicitly approved with an approval note before it can be sent.
- A confirmation prompt appears before sending.
- A delivery record and admin audit event are written for each attempt.
- Each approved draft has one delivery record and a provider idempotency key, preventing duplicate sends from double clicks, retries, or concurrent requests.
- Each message identifies BubsBookings as the advertiser, includes the configured mailing address, and provides an unsubscribe link. An unsubscribe immediately adds the email to the permanent provider-outreach suppression list.

This implementation supports the workflow but is not legal advice. Before activating it, have a qualified attorney review the final templates, business identity, mailing address, consent/suppression process, and any state-specific requirements.
