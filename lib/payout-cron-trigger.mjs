const PAYOUT_RELEASES_PATH = "/api/cron/payment-releases";
const BOOKING_REMINDERS_PATH = "/api/cron/booking-reminders";
const REQUEST_TIMEOUT_MS = 30_000;

export function resolvePayoutReleasesUrl(origin) {
  if (!origin?.trim()) {
    throw new Error("PAYOUT_CRON_ORIGIN is required.");
  }

  let url;
  try {
    url = new URL(origin);
  } catch {
    throw new Error("PAYOUT_CRON_ORIGIN must be a valid absolute URL.");
  }

  const allowsLocalHttp = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
  if (url.protocol !== "https:" && !(allowsLocalHttp && url.protocol === "http:")) {
    throw new Error("PAYOUT_CRON_ORIGIN must use HTTPS outside local development and tests.");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("PAYOUT_CRON_ORIGIN must contain only the BubsBookings site origin.");
  }

  return new URL(PAYOUT_RELEASES_PATH, url);
}

export async function triggerCronEndpoint({
  path,
  origin = process.env.SCHEDULED_CRON_ORIGIN ?? process.env.PAYOUT_CRON_ORIGIN,
  secret = process.env.CRON_SECRET,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  if (!secret?.trim()) {
    throw new Error("CRON_SECRET is required.");
  }

  if (path !== PAYOUT_RELEASES_PATH && path !== BOOKING_REMINDERS_PATH) {
    throw new Error("The scheduled operation path is not allowed.");
  }
  const originUrl = resolvePayoutReleasesUrl(origin);
  const url = new URL(path, originUrl);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Payout release endpoint returned HTTP ${response.status} with a non-JSON response.`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Payout release endpoint returned invalid JSON with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(`Payout release endpoint returned HTTP ${response.status}.`);
  }
  if (!body || typeof body !== "object" || body.ok !== true) {
    throw new Error("Payout release endpoint did not confirm a successful run.");
  }

  return body;
}

export function triggerPaymentReleases(options = {}) {
  return triggerCronEndpoint({ ...options, path: PAYOUT_RELEASES_PATH });
}

export async function triggerScheduledOperations(options = {}) {
  const operations = [
    ["paymentReleases", PAYOUT_RELEASES_PATH],
    ["bookingReminders", BOOKING_REMINDERS_PATH],
  ];
  const results = {};
  const failures = [];

  for (const [name, path] of operations) {
    try {
      results[name] = await triggerCronEndpoint({ ...options, path });
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }

  if (failures.length) {
    throw new Error(`Scheduled operations failed: ${failures.join("; ")}`);
  }
  return results;
}
