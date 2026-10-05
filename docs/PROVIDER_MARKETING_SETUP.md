# Provider marketing production setup

Provider campaigns are intentionally disabled until all marketing-only settings are present. Transactional email continues to use `RESEND_API_KEY` and `EMAIL_FROM`; never reuse that sending domain or API key for campaigns.

1. Add and verify a dedicated marketing subdomain in Resend, for example `mail.bubsbookings.com`.
2. Publish the exact SPF and DKIM records Resend supplies. Add a DMARC record for the organizational domain with reporting enabled; move enforcement from monitoring to quarantine/reject only after reviewing reports. Do not replace an existing SPF record—merge authorized senders into the single record permitted by SPF.
3. Set `RESEND_MARKETING_API_KEY`, `MARKETING_EMAIL_FROM`, and a separate high-entropy `MARKETING_TOKEN_SECRET` in DigitalOcean.
4. Create a Resend webhook for delivered, bounced, and complained events pointing to `/api/webhooks/marketing-email`. Set its signing secret as `RESEND_MARKETING_WEBHOOK_SECRET`.
5. Schedule `POST /api/cron/marketing-campaigns` every minute with `Authorization: Bearer $CRON_SECRET`. The job claims small database batches, is retry-safe, and rechecks preferences and suppressions per recipient.
6. Send seed tests to Gmail, Apple Mail, and Outlook; verify From alignment, DKIM pass, SPF pass, DMARC pass, visible unsubscribe, and one-click unsubscribe before enabling a provider.

DNS and provider-console status cannot be inferred from source code. Confirm them in Resend and the authoritative DNS console before production sending.
