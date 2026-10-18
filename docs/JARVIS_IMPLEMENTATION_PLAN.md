# Jarvis technical feasibility and phased plan

## Feasibility assessment

Jarvis is feasible within the existing BubsBookings architecture. The application already provides server-side administrator authorization, optional administrator two-factor enforcement, PostgreSQL operational data, first-party analytics, audit records, Stripe event records, DigitalOcean scheduled jobs, and GitHub Actions checks.

The safe architecture is to keep every credential and integration on the server. The browser communicates only with BubsBookings routes. Jarvis receives the smallest authorized data set needed for each capability. High-impact actions remain unavailable unless a later phase adds a narrow, separately authorized approval workflow.

## Existing architecture

- Application: Next.js App Router on DigitalOcean App Platform.
- Database: DigitalOcean Managed PostgreSQL with ordered SQL migrations.
- Authentication: Better Auth with server-side admin checks and optional required two-factor authentication.
- Operations: database-backed checks, support cases, bug reports, email delivery records, booking and payout states, and Stripe webhook records.
- Analytics: first-party aggregate events, plus separately configured analytics integrations.
- Scheduled work: one DigitalOcean scheduled component calls protected cron routes every 15 minutes.
- Source control: private GitHub repository on `main`. The current security workflow has read-only repository permissions and runs dependency audit, the payment migration test, lint, and production build on pushes and pull requests.

## Phase 1: implemented

Phase 1 adds an admin-only, read-only chat and browser voice interface at `/admin/jarvis`.

Security boundaries:

- Existing server-side admin authorization applies to the page and API.
- Same-origin POST checks and authenticated rate limits protect the route.
- Only aggregate counts are queried. Names, emails, addresses, messages, notes, payment credentials, and secrets are excluded.
- OpenAI requests use a server-only key, `store: false`, a configured model, and a fixed output limit.
- The model receives no tools and therefore cannot modify BubsBookings.
- Prompt instructions treat metrics and questions as untrusted data.
- Daily request and token budgets are reserved atomically in PostgreSQL before an API request.
- Audit records store a question hash and length, not the raw question.
- Browser voice input and spoken answers require separate deliberate actions.
- Deterministic incident detection identifies recent failed operations checks, stuck Stripe webhooks, failed payouts, elevated payment failures, email failures, and booking cancellations.

## Phase 2: planned, not implemented

Phase 2 adds the secure phone foundation through Twilio and the OpenAI voice API. A signed-in administrator generates a six-digit, one-time code that expires after 10 minutes. Twilio validates the code before routing the call to OpenAI through encrypted SIP. Twilio and OpenAI webhooks are signature-verified and deduplicated.

GPT-6 Luna is the default text, reasoning, and code-task model. It does not support audio. Phone sessions therefore use a dedicated OpenAI realtime voice model. After the caller completes strong authentication, the voice session may hand a structured bug report or operational question to the GPT-6 Luna workflow.

The intended inbound coding flow is:

1. The administrator generates a short-lived, single-use phone code while signed into BubsBookings.
2. The SIP provider connects the call only after the caller supplies that code. Caller ID is never sufficient authorization.
3. Jarvis repeats the proposed bug title, observed behavior, expected behavior, and affected page for confirmation.
4. The confirmed report creates an audited code task with no customer private data.
5. A coding agent works only in an isolated branch or sandbox, runs required tests, and opens a pull request.
6. Jarvis reports the pull request and test results. It cannot merge or deploy it.

Outbound incident calls remain off by default and require:

- Explicit administrator opt-in.
- Verified destination numbers.
- Configured severity thresholds and approved calling hours.
- A durable incident table with deterministic deduplication keys.
- A hard daily outbound-call limit and a two-minute maximum call duration.
- Approved calling hours, configured as 7 AM through 9 PM Pacific by default.
- Acknowledgement, retry, cooldown, and escalation state.
- Separate daily and monthly voice spending limits.
- No customer or provider private data in call prompts or recordings.

## Phase 3: planned, not implemented

Phase 3 should use a dedicated GitHub App, not a personal access token. Recommended permissions are repository contents read and write, pull requests read and write, checks read, and metadata read. Administration, secrets, deployments, environments, organization access, and workflow modification should remain unavailable.

Jarvis may create a branch, propose a narrow change, open a pull request, and summarize existing CI results. It must not merge or deploy. Production deployment must remain protected by an explicit human approval outside the model. Financial actions, account restrictions, secret changes, and production-data mutations must never be inferred from chat approval.

The preferred coding runtime is the OpenAI Agents API with a managed Codex harness and an isolated sandbox. GPT-6 Luna can handle focused fixes and triage. Higher-risk or repeatedly failing work should stop for human review rather than silently switching models or increasing spend. A dedicated GitHub App should publish only the resulting branch and pull request after tests complete.

Before Phase 3, the GitHub workflow should also run the full automated test command in addition to its current dependency, migration, lint, and build checks.

## Configuration

Phase 1 requires these server-only values:

- `OPENAI_API_KEY`
- `JARVIS_OPENAI_MODEL`, which defaults to `gpt-6-luna`
- `JARVIS_DAILY_REQUEST_LIMIT`
- `JARVIS_DAILY_TOKEN_LIMIT`

No value should use a `NEXT_PUBLIC_` prefix. The database migration must be applied before the route is used.

## Cost controls

Phase 1 has no new browser package, phone number, or hosting component. Its variable cost is OpenAI API usage. The fixed output limit and database-enforced daily request and token limits bound usage. Exact cost depends on the configured model and current OpenAI pricing.

Phase 2 would add phone-number rental, telephony minutes, and Realtime audio usage. GPT-6 Luna does not accept audio, so the phone leg must use an OpenAI realtime voice model and hand authenticated operational or coding tasks to GPT-6 Luna. Phase 3 may use OpenAI Agents API sandbox time and GitHub Actions minutes depending on the repository plan and workload.

## Current limitations

- Phase 1 requires an OpenAI API key and model configuration before it can answer.
- The browser determines whether speech recognition is available and may process audio under that browser vendor's terms.
- Operational incidents are visible in chat but do not yet create alerts or phone calls.
- The assistant has no conversation memory between requests.
- No production OpenAI request has been made by automated tests.
- Phone and GitHub write integrations remain intentionally unavailable.
