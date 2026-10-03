import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { scanContent } from "@/lib/content-safety";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as {token?:unknown;displayName?:unknown;relationship?:unknown;recommendation?:unknown}|null;
  const token=typeof body?.token==="string"?body.token:"";const displayName=typeof body?.displayName==="string"?body.displayName.trim():"";const relationship=typeof body?.relationship==="string"?body.relationship.trim():"";const recommendation=typeof body?.recommendation==="string"?body.recommendation.trim():"";
  if(token.length<30||!displayName||displayName.length>80||relationship.length<2||relationship.length>120||recommendation.length<20||recommendation.length>1500)return NextResponse.json({error:"Complete every field within the stated limits."},{status:400});
  const tokenHash=createHash("sha256").update(token).digest("hex");
  if(!await enforceRateLimit({request,userId:tokenHash,bucket:"recommendation-submit",limit:5,windowSeconds:3600}))return NextResponse.json({error:"Too many attempts. Please try later."},{status:429});
  const session=await auth.api.getSession({headers:await headers()});
  const requestRecord=await database.query<{id:string;provider_id:string;owner_id:string}>(`SELECT request.id::text,request.provider_id::text,provider.user_id AS owner_id FROM provider_recommendation_requests request JOIN provider_profiles provider ON provider.id=request.provider_id WHERE request.token_hash=$1 AND request.used_at IS NULL AND request.expires_at>now()`,[tokenHash]);
  const record=requestRecord.rows[0];if(!record)return NextResponse.json({error:"This recommendation link is invalid, expired, or already used."},{status:404});
  if(session?.user.id===record.owner_id)return NextResponse.json({error:"Providers cannot submit recommendations for themselves."},{status:403});
  const safety=scanContent([displayName,relationship,recommendation].join("\n"));if(!safety.allowed)return NextResponse.json({error:safety.message},{status:422});
  const client=await database.connect();try{await client.query("BEGIN");const used=await client.query("UPDATE provider_recommendation_requests SET used_at=now() WHERE id::text=$1 AND used_at IS NULL RETURNING id",[record.id]);if(!used.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"This link was already used."},{status:409});}await client.query("INSERT INTO provider_recommendations(provider_id,request_id,display_name,relationship,body) VALUES($1,$2,$3,$4,$5)",[record.provider_id,record.id,displayName,relationship,recommendation]);await client.query("COMMIT");return NextResponse.json({ok:true},{status:201});}catch(error){await client.query("ROLLBACK");console.error("Recommendation submission failed",error);return NextResponse.json({error:"We could not submit the recommendation."},{status:500});}finally{client.release();}
}
