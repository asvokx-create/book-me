import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { runAutomatedProviderVerification } from "@/lib/provider-verification";

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const pending = await database.query<{ provider_id: string }>(`SELECT DISTINCT provider_id::text
    FROM provider_verification_requests WHERE status = 'pending' ORDER BY provider_id::text LIMIT 25`);
  const results = [];
  for (const row of pending.rows) {
    const result = await runAutomatedProviderVerification(row.provider_id);
    if (result) results.push(result);
  }
  return NextResponse.json({ checked: results.length, results });
}
