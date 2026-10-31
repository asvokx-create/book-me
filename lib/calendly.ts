import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "@/lib/database";
import { verifyCalendlyWebhookSignature } from "@/lib/calendly-webhook";

const API_ORIGIN = "https://api.calendly.com";
const AUTH_ORIGIN = "https://auth.calendly.com";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  owner: string;
  organization: string;
  scope?: string;
};

type ConnectionRow = {
  id: string;
  provider_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: Date;
  calendly_user_uri: string;
  calendly_organization_uri: string;
  webhook_subscription_uri: string | null;
};

type CalendlyEvent = {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  end_time: string;
  updated_at?: string;
  location?: { type?: string; location?: string; join_url?: string } | null;
};

export function calendlyConfiguration() {
  const clientId = process.env.CALENDLY_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET?.trim() ?? "";
  const encryptionSecret = process.env.CALENDLY_ENCRYPTION_KEY?.trim() ?? "";
  const webhookSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() ?? "";
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    encryptionSecret,
    webhookSigningKey,
    appOrigin,
    redirectUri: `${appOrigin}/api/integrations/calendly/callback`,
    webhookUrl: `${appOrigin}/api/webhooks/calendly`,
    configured: Boolean(clientId && clientSecret && encryptionSecret),
  };
}

function encryptionKey() {
  const secret = calendlyConfiguration().encryptionSecret;
  if (!secret) throw new Error("Calendly credential encryption is not configured.");
  return createHash("sha256").update(`bubsbookings-calendly-v1:${secret}`).digest();
}

export function encryptCalendlySecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptCalendlySecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Stored Calendly credential is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function basicAuthorization() {
  const config = calendlyConfiguration();
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
}

async function tokenRequest(parameters: Record<string, string>) {
  const response = await fetch(`${AUTH_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basicAuthorization(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: calendlyConfiguration().clientId, ...parameters }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Calendly authorization failed (${response.status}).`);
  return await response.json() as TokenResponse;
}

async function apiRequest<T>(token: string, pathOrUrl: string, init?: RequestInit) {
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${API_ORIGIN}${pathOrUrl}`;
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`Calendly API request failed (${response.status}).`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function createCalendlyAuthorization(providerId: string) {
  const config = calendlyConfiguration();
  if (!config.configured) throw new Error("Calendly is not configured yet.");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  await database.query("DELETE FROM provider_calendly_oauth_states WHERE provider_id::text=$1 OR expires_at<now()", [providerId]);
  await database.query(
    `INSERT INTO provider_calendly_oauth_states(state_hash,provider_id,code_verifier_encrypted,expires_at)
     VALUES($1,$2::uuid,$3,now()+interval '10 minutes')`,
    [createHash("sha256").update(state).digest("hex"), providerId, encryptCalendlySecret(verifier)],
  );
  const url = new URL(`${AUTH_ORIGIN}/oauth/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function completeCalendlyAuthorization(input: { providerId: string; state: string; code: string }) {
  const stateHash = createHash("sha256").update(input.state).digest("hex");
  const stateResult = await database.query<{ provider_id: string; code_verifier_encrypted: string }>(
    `DELETE FROM provider_calendly_oauth_states
     WHERE state_hash=$1 AND provider_id::text=$2 AND expires_at>now()
     RETURNING provider_id::text,code_verifier_encrypted`,
    [stateHash, input.providerId],
  );
  const stored = stateResult.rows[0];
  if (!stored) throw new Error("Calendly connection expired or could not be verified. Please try again.");
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: calendlyConfiguration().redirectUri,
    code_verifier: decryptCalendlySecret(stored.code_verifier_encrypted),
  });
  const current = await apiRequest<{ resource: { uri: string; name: string; email: string; timezone: string; scheduling_url?: string; current_organization: string } }>(token.access_token, "/users/me");
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  const result = await database.query<{ id: string }>(
    `INSERT INTO provider_calendly_connections(provider_id,calendly_user_uri,calendly_organization_uri,account_name,account_email,
       account_timezone,scheduling_url,access_token_encrypted,refresh_token_encrypted,token_expires_at,granted_scope,disconnected_at,updated_at)
     VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,now())
     ON CONFLICT(provider_id) DO UPDATE SET calendly_user_uri=excluded.calendly_user_uri,
       calendly_organization_uri=excluded.calendly_organization_uri,account_name=excluded.account_name,
       account_email=excluded.account_email,account_timezone=excluded.account_timezone,scheduling_url=excluded.scheduling_url,
       access_token_encrypted=excluded.access_token_encrypted,refresh_token_encrypted=excluded.refresh_token_encrypted,
       token_expires_at=excluded.token_expires_at,granted_scope=excluded.granted_scope,disconnected_at=NULL,
       last_sync_error=NULL,updated_at=now()
     RETURNING id::text`,
    [input.providerId, current.resource.uri, current.resource.current_organization || token.organization, current.resource.name,
      current.resource.email, current.resource.timezone || "UTC", current.resource.scheduling_url ?? null,
      encryptCalendlySecret(token.access_token), encryptCalendlySecret(token.refresh_token), expiresAt, token.scope ?? ""],
  );
  await syncCalendlyConnection(result.rows[0].id);
  await configureCalendlyWebhook(result.rows[0].id);
}

async function connectionToken(connectionId: string) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<ConnectionRow>(
      `SELECT id::text,provider_id::text,access_token_encrypted,refresh_token_encrypted,token_expires_at,
              calendly_user_uri,calendly_organization_uri,webhook_subscription_uri
       FROM provider_calendly_connections WHERE id::text=$1 AND disconnected_at IS NULL FOR UPDATE`, [connectionId],
    );
    const connection = result.rows[0];
    if (!connection) throw new Error("Calendly is not connected.");
    if (connection.token_expires_at.getTime() > Date.now() + 60_000) {
      await client.query("COMMIT");
      return { connection, token: decryptCalendlySecret(connection.access_token_encrypted) };
    }
    const refreshed = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptCalendlySecret(connection.refresh_token_encrypted) });
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await client.query(
      `UPDATE provider_calendly_connections SET access_token_encrypted=$2,refresh_token_encrypted=$3,
       token_expires_at=$4,granted_scope=$5,updated_at=now(),last_sync_error=NULL WHERE id::text=$1`,
      [connectionId, encryptCalendlySecret(refreshed.access_token), encryptCalendlySecret(refreshed.refresh_token), expiresAt, refreshed.scope ?? ""],
    );
    await client.query("COMMIT");
    return { connection: { ...connection, token_expires_at: expiresAt }, token: refreshed.access_token };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function eventLocation(event: CalendlyEvent) {
  return event.location?.location || event.location?.join_url || (event.location?.type === "zoom" ? "Video meeting" : "Calendly appointment");
}

async function upsertEvent(client: Pick<PoolClient, "query">, input: { connectionId: string; providerId: string; event: CalendlyEvent; inviteeUri?: string | null; rescheduled?: boolean; timezone?: string }) {
  await client.query(
    `INSERT INTO provider_calendly_events(connection_id,provider_id,external_event_uri,external_invitee_uri,title,starts_at,ends_at,
       status,location,event_timezone,rescheduled,source_updated_at,last_seen_at,updated_at)
     VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now())
     ON CONFLICT(connection_id,external_event_uri) DO UPDATE SET
       external_invitee_uri=COALESCE(excluded.external_invitee_uri,provider_calendly_events.external_invitee_uri),
       title=excluded.title,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,
       location=excluded.location,event_timezone=excluded.event_timezone,rescheduled=excluded.rescheduled,
       source_updated_at=COALESCE(excluded.source_updated_at,provider_calendly_events.source_updated_at),last_seen_at=now(),updated_at=now()
     WHERE provider_calendly_events.source_updated_at IS NULL OR excluded.source_updated_at IS NULL
       OR excluded.source_updated_at>=provider_calendly_events.source_updated_at`,
    [input.connectionId, input.providerId, input.event.uri, input.inviteeUri ?? null, input.event.name.slice(0, 240), input.event.start_time,
      input.event.end_time, input.event.status, eventLocation(input.event).slice(0, 300), input.timezone ?? "UTC",
      input.rescheduled ?? false, input.event.updated_at ?? null],
  );
}

export async function syncCalendlyConnection(connectionId: string) {
  await database.query("UPDATE provider_calendly_connections SET last_sync_started_at=now(),last_sync_error=NULL WHERE id::text=$1", [connectionId]);
  try {
    const { connection, token } = await connectionToken(connectionId);
    let nextUrl: string | null = new URL("/scheduled_events", API_ORIGIN).toString();
    const first = new URL(nextUrl);
    first.searchParams.set("user", connection.calendly_user_uri);
    first.searchParams.set("min_start_time", new Date(Date.now() - 30 * 86_400_000).toISOString());
    first.searchParams.set("max_start_time", new Date(Date.now() + 548 * 86_400_000).toISOString());
    first.searchParams.set("sort", "start_time:asc");
    first.searchParams.set("count", "100");
    nextUrl = first.toString();
    let pages = 0;
    while (nextUrl && pages < 20) {
      const page: { collection: CalendlyEvent[]; pagination?: { next_page?: string | null } } = await apiRequest(token, nextUrl);
      for (const event of page.collection) await upsertEvent(database, { connectionId, providerId: connection.provider_id, event });
      nextUrl = page.pagination?.next_page ?? null;
      pages += 1;
    }
    await database.query("UPDATE provider_calendly_connections SET last_sync_succeeded_at=now(),last_sync_error=NULL,updated_at=now() WHERE id::text=$1", [connectionId]);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Calendly synchronization failed.";
    await database.query("UPDATE provider_calendly_connections SET last_sync_error=$2,updated_at=now() WHERE id::text=$1", [connectionId, message]);
    throw error;
  }
}

export async function configureCalendlyWebhook(connectionId: string) {
  const config = calendlyConfiguration();
  if (!config.webhookSigningKey) {
    await database.query("UPDATE provider_calendly_connections SET webhook_status='not_configured' WHERE id::text=$1", [connectionId]);
    return;
  }
  try {
    const { connection, token } = await connectionToken(connectionId);
    const response = await apiRequest<{ resource: { uri: string } }>(token, "/webhook_subscriptions", {
      method: "POST",
      body: JSON.stringify({ url: config.webhookUrl, events: ["invitee.created", "invitee.canceled"], organization: connection.calendly_organization_uri, user: connection.calendly_user_uri, scope: "user" }),
    });
    await database.query("UPDATE provider_calendly_connections SET webhook_subscription_uri=$2,webhook_status='active',updated_at=now() WHERE id::text=$1", [connectionId, response.resource.uri]);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    await database.query("UPDATE provider_calendly_connections SET webhook_status=$2,last_sync_error=$3,updated_at=now() WHERE id::text=$1", [connectionId, status === 403 ? "unsupported" : "failed", status === 403 ? "Automatic Calendly updates require a paid Calendly plan. Manual sync remains available." : "Calendly automatic updates could not be enabled."]);
  }
}

export function verifyCalendlyWebhook(rawBody: string, header: string | null) {
  return verifyCalendlyWebhookSignature({ rawBody, header, signingKey: calendlyConfiguration().webhookSigningKey });
}

export async function processCalendlyWebhook(rawBody: string) {
  const hash = createHash("sha256").update(rawBody).digest("hex");
  const payload = JSON.parse(rawBody) as { event?: string; created_at?: string; payload?: Record<string, unknown> };
  const claimed = await database.query(
    `INSERT INTO calendly_webhook_deliveries(payload_hash,event_type) VALUES($1,$2)
     ON CONFLICT(payload_hash) DO NOTHING RETURNING payload_hash`, [hash, payload.event ?? "unknown"],
  );
  if (!claimed.rowCount) return { duplicate: true };
  try {
    if (payload.event !== "invitee.created" && payload.event !== "invitee.canceled") {
      await database.query("UPDATE calendly_webhook_deliveries SET status='ignored',processed_at=now() WHERE payload_hash=$1", [hash]);
      return { ignored: true };
    }
    const data = payload.payload ?? {};
    const eventUri = typeof data.event === "string" ? data.event : "";
    const inviteeUri = typeof data.uri === "string" ? data.uri : null;
    const scheduledEvent = data.scheduled_event && typeof data.scheduled_event === "object" ? data.scheduled_event as Record<string, unknown> : {};
    const memberships = Array.isArray(scheduledEvent.event_memberships) ? scheduledEvent.event_memberships : [];
    const membershipUser = (memberships[0] as Record<string, unknown> | undefined)?.user;
    const resolvedUser = typeof membershipUser === "string" ? membershipUser : null;
    if (!eventUri || !resolvedUser) throw new Error("Calendly webhook did not identify an event owner.");
    const connectionResult = await database.query<ConnectionRow>(
      `SELECT id::text,provider_id::text,access_token_encrypted,refresh_token_encrypted,token_expires_at,
              calendly_user_uri,calendly_organization_uri,webhook_subscription_uri
       FROM provider_calendly_connections WHERE calendly_user_uri=$1 AND disconnected_at IS NULL`, [resolvedUser],
    );
    const connection = connectionResult.rows[0];
    if (!connection) {
      await database.query("UPDATE calendly_webhook_deliveries SET status='ignored',processed_at=now() WHERE payload_hash=$1", [hash]);
      return { ignored: true };
    }
    const canceled = payload.event === "invitee.canceled";
    const event = {
      uri: eventUri,
      name: typeof scheduledEvent.name === "string" ? scheduledEvent.name : "Calendly appointment",
      status: canceled ? "canceled" as const : "active" as const,
      start_time: String(scheduledEvent.start_time ?? ""),
      end_time: String(scheduledEvent.end_time ?? ""),
      updated_at: typeof scheduledEvent.updated_at === "string" ? scheduledEvent.updated_at : payload.created_at,
      location: scheduledEvent.location && typeof scheduledEvent.location === "object" ? scheduledEvent.location as CalendlyEvent["location"] : null,
    };
    if (!event.start_time || !event.end_time) throw new Error("Calendly webhook did not include appointment times.");
    await upsertEvent(database, { connectionId: connection.id, providerId: connection.provider_id, event, inviteeUri, rescheduled: data.rescheduled === true, timezone: typeof data.timezone === "string" ? data.timezone : "UTC" });
    await database.query("UPDATE calendly_webhook_deliveries SET provider_id=$2::uuid,status='processed',processed_at=now() WHERE payload_hash=$1", [hash, connection.provider_id]);
    return { processed: true };
  } catch (error) {
    await database.query("UPDATE calendly_webhook_deliveries SET status='failed',error_message=$2,processed_at=now() WHERE payload_hash=$1", [hash, error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed."]);
    throw error;
  }
}

export async function disconnectCalendly(connectionId: string) {
  const { connection, token } = await connectionToken(connectionId);
  if (connection.webhook_subscription_uri) await apiRequest(token, connection.webhook_subscription_uri, { method: "DELETE" }).catch(() => undefined);
  const config = calendlyConfiguration();
  await fetch(`${AUTH_ORIGIN}/oauth/revoke`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, token }) }).catch(() => undefined);
  await database.query(
    `UPDATE provider_calendly_connections SET disconnected_at=now(),access_token_encrypted='',refresh_token_encrypted='',
       webhook_subscription_uri=NULL,webhook_status='not_configured',updated_at=now() WHERE id::text=$1`, [connectionId],
  );
}
