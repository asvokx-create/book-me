import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { readMarketingToken, signedMarketingToken } from "@/lib/provider-marketing";

export async function GET(request: Request) {
  const url = new URL(request.url); const data = readMarketingToken(url.searchParams.get("token") || ""); const target = url.searchParams.get("to") || "/";
  const safeTarget = target.startsWith("/") && !target.startsWith("//") ? target : "/";
  if (!data?.r || !data.p) return NextResponse.redirect(new URL(safeTarget, url.origin));
  const recipient = await database.query<{ customer_id: string }>(`SELECT customer_id FROM marketing_campaign_recipients WHERE id::text=$1 AND provider_id::text=$2`, [data.r, data.p]).then((result) => result.rows[0]);
  if (!recipient) return NextResponse.redirect(new URL(safeTarget, url.origin));
  await database.query(`INSERT INTO marketing_email_events(recipient_id,provider_id,event_type,metadata) VALUES($1,$2,'click',$3::jsonb)`, [data.r, data.p, JSON.stringify({ path: safeTarget })]);
  await database.query(`INSERT INTO marketing_attributions(recipient_id,provider_id,customer_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [data.r, data.p, recipient.customer_id]);
  const response = NextResponse.redirect(new URL(safeTarget, url.origin));
  response.cookies.set("bb_campaign", signedMarketingToken({ r: data.r, p: data.p, u: recipient.customer_id }, 30), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 86400, path: "/" });
  return response;
}
