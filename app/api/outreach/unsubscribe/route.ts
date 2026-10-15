import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { readOutreachUnsubscribeToken } from "@/lib/provider-outreach-email";

function emailHash(value: string) { return createHash("sha256").update(value.trim().toLowerCase()).digest("hex"); }

async function unsubscribe(token: string) {
  const data = readOutreachUnsubscribeToken(token);
  if (!data) return false;
  const delivery = await database.query<{ prospect_id: string; recipient_email: string }>(`SELECT prospect_id::text,recipient_email FROM provider_outreach_deliveries WHERE id::text=$1 AND lower(recipient_email)=lower($2) LIMIT 1`, [data.deliveryId, data.email]).then((result) => result.rows[0]);
  if (!delivery) return false;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO provider_outreach_suppressions(email_hash,reason,note) VALUES($1,'opt_out','Recipient used the provider outreach unsubscribe link.') ON CONFLICT(email_hash) DO NOTHING`, [emailHash(delivery.recipient_email)]);
    await client.query(`UPDATE provider_outreach_prospects SET status='suppressed' WHERE id::text=$1`, [delivery.prospect_id]);
    await client.query(`UPDATE provider_outreach_deliveries SET status='unsubscribed' WHERE id::text=$1`, [data.deliveryId]);
    await client.query("COMMIT");
    return true;
  } catch (error) { await client.query("ROLLBACK"); console.error("Outreach unsubscribe failed", error); return false; }
  finally { client.release(); }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type") || "";
  let token = url.searchParams.get("token") || "";
  if (!token && contentType.includes("application/json")) token = String((await request.json().catch(() => ({})) as { token?: unknown }).token || "");
  else if (!token) token = String((await request.formData().catch(() => new FormData())).get("token") || "");
  const ok = await unsubscribe(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
