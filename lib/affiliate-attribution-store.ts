import "server-only";

import { database } from "@/lib/database";
import { newAttributionToken, normalizeAffiliateCode, safeInternalDestination } from "@/lib/affiliates";

const ATTRIBUTION_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AttributionInput = {
  code: unknown;
  landingPath: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  savedToken?: string | null;
};

type AttributionResult =
  | { status: "invalid"; code: string }
  | { status: "retained"; code: string }
  | { status: "created"; code: string; token: string; maxAge: number };

export async function recordAffiliateRawClick(input: Omit<AttributionInput, "savedToken">) {
  const code = normalizeAffiliateCode(input.code);
  if (!code) return false;

  const result = await database.query<{ inserted: boolean }>(
    `INSERT INTO affiliate_click_events (affiliate_id, program_id, affiliate_code, landing_path,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term)
      SELECT affiliate.id, program.id, $1, $2, $3, $4, $5, $6, $7
      FROM affiliate_profiles affiliate
      JOIN affiliate_programs program ON program.id = affiliate.program_id
      WHERE lower(affiliate.affiliate_code) = lower($1)
        AND affiliate.status = 'active' AND program.status = 'enabled'
        AND (program.starts_at IS NULL OR program.starts_at <= now())
        AND (program.ends_at IS NULL OR program.ends_at > now())
      RETURNING true AS inserted`,
    [
      code,
      safeInternalDestination(input.landingPath),
      text(input.utmSource),
      text(input.utmMedium),
      text(input.utmCampaign),
      text(input.utmContent),
      text(input.utmTerm),
    ],
  );
  return result.rows[0]?.inserted === true;
}

export async function storeAffiliateAttribution(input: AttributionInput): Promise<AttributionResult> {
  const code = normalizeAffiliateCode(input.code);
  if (!code) return { status: "invalid", code: "" };

  const savedToken = input.savedToken?.trim() ?? "";
  if (ATTRIBUTION_TOKEN.test(savedToken)) {
    const saved = await database.query<{ affiliate_code: string }>(
      `SELECT click.affiliate_code
       FROM affiliate_clicks click
       JOIN affiliate_profiles affiliate ON affiliate.id = click.affiliate_id
       JOIN affiliate_programs program ON program.id = click.program_id
       WHERE click.attribution_token = $1::uuid
         AND affiliate.status = 'active' AND program.status = 'enabled'
         AND click.created_at > now() - make_interval(days => program.attribution_window_days)
         AND (program.starts_at IS NULL OR program.starts_at <= now())
         AND (program.ends_at IS NULL OR program.ends_at > now())
       LIMIT 1`,
      [savedToken],
    );
    if (saved.rows[0]) return { status: "retained", code: saved.rows[0].affiliate_code };
  }

  const affiliate = await database.query<{ affiliate_id: string; program_id: string; attribution_window_days: number }>(
    `SELECT affiliate.id::text AS affiliate_id, program.id::text AS program_id, program.attribution_window_days
     FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id = affiliate.program_id
     WHERE lower(affiliate.affiliate_code) = lower($1) AND affiliate.status = 'active'
       AND program.status = 'enabled' AND (program.starts_at IS NULL OR program.starts_at <= now())
       AND (program.ends_at IS NULL OR program.ends_at > now()) LIMIT 1`,
    [code],
  );
  const match = affiliate.rows[0];
  if (!match) return { status: "invalid", code };

  const token = newAttributionToken();
  await database.query(
    `INSERT INTO affiliate_clicks (affiliate_id, program_id, attribution_token, affiliate_code, landing_path,
        utm_source, utm_medium, utm_campaign, utm_content, utm_term)
      VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10)`,
    [
      match.affiliate_id,
      match.program_id,
      token,
      code,
      safeInternalDestination(input.landingPath),
      text(input.utmSource),
      text(input.utmMedium),
      text(input.utmCampaign),
      text(input.utmContent),
      text(input.utmTerm),
    ],
  );
  return { status: "created", code, token, maxAge: match.attribution_window_days * 86_400 };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 160) || null : null;
}

export function cookieValue(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
}
