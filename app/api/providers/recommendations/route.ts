import { createHash,randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit,recordActivity } from "@/lib/request-security";
import { sendTransactionalEmail } from "@/lib/email";

export async function GET(){
  const access=await getProviderAccess();if(!access?.isOwner)return NextResponse.json({error:"Only the business owner can manage recommendation requests."},{status:403});
  const result=await database.query(`SELECT recommendation.id::text,recommendation.display_name AS "displayName",recommendation.relationship,recommendation.body,recommendation.moderation_status AS status,recommendation.created_at AS "createdAt" FROM provider_recommendations recommendation WHERE recommendation.provider_id::text=$1 ORDER BY recommendation.created_at DESC`,[access.providerId]);
  return NextResponse.json({recommendations:result.rows});
}

export async function POST(request:Request){
  const access=await getProviderAccess();if(!access?.isOwner)return NextResponse.json({error:"Only the business owner can request recommendations."},{status:403});
  if(!await enforceRateLimit({request,userId:access.session.user.id,bucket:"recommendation-request",limit:10,windowSeconds:86400}))return NextResponse.json({error:"You can send up to ten recommendation requests per day."},{status:429});
  const body=await request.json().catch(()=>null) as {email?:unknown;serviceContext?:unknown}|null;
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";const serviceContext=typeof body?.serviceContext==="string"?body.serviceContext.trim():"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||serviceContext.length>120)return NextResponse.json({error:"Enter a valid client email and a short service context."},{status:400});
  if(email===access.session.user.email.toLowerCase())return NextResponse.json({error:"You cannot send a recommendation request to your own account."},{status:400});
  const token=randomBytes(32).toString("base64url");const tokenHash=createHash("sha256").update(token).digest("hex");
  const created=await database.query<{id:string}>("INSERT INTO provider_recommendation_requests(provider_id,recipient_email,service_context,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '14 days') RETURNING id::text",[access.providerId,email,serviceContext,tokenHash]);
  const business=await database.query<{business_name:string}>("SELECT business_name FROM provider_profiles WHERE id::text=$1",[access.providerId]);
  await sendTransactionalEmail({to:email,emailType:`recommendation-request-${created.rows[0].id}`,idempotencyKey:`recommendation-request-${created.rows[0].id}`,subject:`Share a client recommendation for ${business.rows[0].business_name}`,heading:"Share your experience",message:`${business.rows[0].business_name} invited you to share a client recommendation${serviceContext?` about ${serviceContext}`:""}. Recommendations are reviewed and clearly labeled as outside-client feedback, not verified BubsBookings reviews.`,actionLabel:"Write recommendation",actionUrl:`/recommend/${token}`});
  await recordActivity({userId:access.session.user.id,action:"client_recommendation_requested",targetType:"recommendation_request",targetId:created.rows[0].id});
  return NextResponse.json({ok:true},{status:201});
}
