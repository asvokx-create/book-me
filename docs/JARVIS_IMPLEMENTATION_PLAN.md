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

Phase 1 adds an admin-only operations chat and browser voice interface at `/admin/jarvis`.

Security boundaries:

- Existing server-side admin authorization applies to the page and API.
- Same-origin POST checks and authenticated rate limits protect the route.
- Aggregate counts plus safe admin record IDs, statuses, categories, and BubsBookings page paths are queried. Names, emails, addresses, messages, notes, payment credentials, and secrets are excluded.
- OpenAI requests use a server-only key, `store: false`, a configured model, and a fixed output limit.
- The model receives no tools and therefore cannot modify BubsBookings.
- Prompt instructions treat metrics and questions as untrusted data.
- Daily request and token budgets are reserved atomically in PostgreSQL before an API request.
- Audit records store a question hash and length, not the raw question.
- Browser voice input and spoken answers require separate deliberate actions.
- Deterministic incident detection identifies recent failed operations checks, stuck Stripe webhooks, failed payouts, elevated payment failures, email failures, and booking cancellations.

## Phase 2: secure phone foundation implemented

Phase 2 adds the secure phone foundation through Twilio and the OpenAI voice API. A signed-in administrator generates a six-digit, one-time code that expires after 10 minutes. Twilio validates the code before routing the call to OpenAI through encrypted SIP. Twilio and OpenAI webhooks are signature-verified and deduplicated.

GPT-6 Luna is the default text, reasoning, and code-task model. It does not support audio. Phone sessions therefore use a dedicated OpenAI realtime voice model. The current phone session can answer operational questions but cannot create a code task until the realtime server tool loop is implemented.

The remaining inbound coding flow is:

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

## Phase 3: approval-gated Codex foundation implemented

Phase 3 should use a dedicated GitHub App, not a personal access token. Recommended permissions are repository contents read and write, pull requests read and write, checks read, and metadata read. Administration, secrets, deployments, environments, organization access, and workflow modification should remain unavailable.

The intended GitHub publishing phase may create a branch, propose a narrow change, open a pull request, and summarize existing CI results. It must not merge or deploy. Production deployment must remain protected by an explicit human approval outside the model. Financial actions, account restrictions, secret changes, and production-data mutations must never be inferred from chat approval.

The admin interface can create a draft repair task and show its exact contents. A separate admin action approves and dispatches the task to the OpenAI Agents API in a preconfigured hosted environment. Every task has a per-session spending limit and an audit record. Codex is instructed to inspect the repository, make the smallest safe change, run checks, and never deploy automatically.

The hosted environment must be prepared separately and must not contain production secrets. A future dedicated GitHub App may publish reviewed branches and pull requests. The current bridge does not merge, deploy, or grant repository administration access.

Before Phase 3, the GitHub workflow should also run the full automated test command in addition to its current dependency, migration, lint, and build checks.

## Configuration

Phase 1 requires these server-only values:

- `OPENAI_API_KEY`
- `JARVIS_OPENAI_MODEL`, which defaults to `gpt-6-luna`
- `JARVIS_DAILY_REQUEST_LIMIT`
- `JARVIS_DAILY_TOKEN_LIMIT`
- `JARVIS_CODEX_ENVIRONMENT_ID`
- `JARVIS_CODEX_MODEL`, which defaults to `gpt-6-luna`
- `JARVIS_CODEX_SPEND_LIMIT_CENTS`, which defaults to 100 cents for each approved task

No value should use a `NEXT_PUBLIC_` prefix. The database migration must be applied before the route is used.

## Cost controls

Phase 1 has no new browser package, phone number, or hosting component. Its variable cost is OpenAI API usage. The fixed output limit and database-enforced daily request and token limits bound usage. Exact cost depends on the configured model and current OpenAI pricing.

Phase 2 would add phone-number rental, telephony minutes, and Realtime audio usage. GPT-6 Luna does not accept audio, so the phone leg must use an OpenAI realtime voice model and hand authenticated operational or coding tasks to GPT-6 Luna. Phase 3 may use OpenAI Agents API sandbox time and GitHub Actions minutes depending on the repository plan and workload.

## Current limitations

- Phase 1 requires an OpenAI API key and model configuration before it can answer.
- The browser determines whether speech recognition is available and may process audio under that browser vendor's terms.
- Outbound incident calls use the configured phone settings and remain off until an administrator opts in.
- The assistant has no conversation memory between requests.
- No production OpenAI request has been made by automated tests.
- An outbound incident call can create an idempotent repair draft when the administrator says "tell Codex to fix it" or presses 1. The draft still requires approval at `/admin/jarvis`.
- The inbound conversational phone session cannot yet create a repair draft from arbitrary spoken bug dictation because its realtime server tool loop is not implemented.
- A Codex task requires a dedicated hosted environment ID. The task stays a draft until an administrator approves it.
- GitHub publishing and pull-request creation remain unavailable until a least-privilege GitHub App is configured. Codex never deploys automatically.
