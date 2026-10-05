import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { emailHash, readMarketingToken } from "@/lib/provider-marketing";

async function unsubscribe(token: string) {
  const data = readMarketingToken(token);
  if (!data?.r || !data.p) return false;
  const recipient = await database.query<{ customer_id: string; email: string }>(`SELECT customer_id,email FROM marketing_campaign_recipients WHERE id::text=$1 AND provider_id::text=$2`, [data.r, data.p]).then((result) => result.rows[0]);
  if (!recipient) return false;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO provider_marketing_preferences(provider_id,customer_id,status,source,unsubscribed_at) VALUES($1,$2,'unsubscribed','campaign_link',now()) ON CONFLICT(provider_id,customer_id) DO UPDATE SET status='unsubscribed',source='campaign_link',unsubscribed_at=now(),updated_at=now()`, [data.p, recipient.customer_id]);
    await client.query(`INSERT INTO marketing_suppressions(provider_id,customer_id,email_hash,reason,source) VALUES($1,$2,$3,'unsubscribed','campaign_link') ON CONFLICT DO NOTHING`, [data.p, recipient.customer_id, emailHash(recipient.email)]);
    await client.query(`UPDATE marketing_campaign_recipients SET status='unsubscribed' WHERE id::text=$1 AND provider_id::text=$2`, [data.r, data.p]);
    await client.query(`INSERT INTO marketing_email_events(recipient_id,provider_id,event_type,metadata) VALUES($1,$2,'unsubscribe','{}')`, [data.r, data.p]);
    await client.query("COMMIT"); return true;
  } catch { await client.query("ROLLBACK"); return false; }
  finally { client.release(); }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || ""; const url = new URL(request.url); let token = url.searchParams.get("token") || "";
  if (!token && contentType.includes("application/json")) token = String((await request.json().catch(() => ({})) as { token?: unknown }).token || "");
  else if (!token) token = String((await request.formData().catch(() => new FormData())).get("token") || "");
  const ok = await unsubscribe(token); return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
