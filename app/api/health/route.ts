import { NextResponse } from "next/server";
import { database } from "@/lib/database";

export async function GET() {
  const startedAt = Date.now();
  try {
    await database.query("SELECT 1");
    return NextResponse.json({ status: "ok", responseMs: Date.now() - startedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "failed", responseMs: Date.now() - startedAt }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
