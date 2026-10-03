import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { enforceRateLimit,recordActivity } from "@/lib/request-security";

export async function GET(){
  const session=await getAdminSession();if(!session)return NextResponse.json({error:"Admin access required."},{status:403});
  const result=await database.query(`SELECT recommendation.id::text,recommendation.display_name AS "displayName",recommendation.relationship,recommendation.body,recommendation.moderation_status AS status,recommendation.created_at AS "createdAt",provider.business_name AS "providerName",provider.public_profile_slug AS "providerSlug" FROM provider_recommendations recommendation JOIN provider_profiles provider ON provider.id=recommendation.provider_id ORDER BY CASE recommendation.moderation_status WHEN 'pending' THEN 0 ELSE 1 END,recommendation.created_at DESC LIMIT 500`);
  return NextResponse.json({recommendations:result.rows});
}

export async function PATCH(request:Request){
  const session=await getAdminSession();if(!session)return NextResponse.json({error:"Admin access required."},{status:403});
  if(!await enforceRateLimit({request,userId:session.user.id,bucket:"admin-recommendations",limit:50}))return NextResponse.json({error:"Too many moderation changes."},{status:429});
  const body=await request.json().catch(()=>null) as {id?:unknown;status?:unknown}|null;const id=typeof body?.id==="string"?body.id:"";const status=typeof body?.status==="string"?body.status:"";
  if(!id||!["approved","hidden","rejected"].includes(status))return NextResponse.json({error:"Choose a valid moderation action."},{status:400});
  const updated=await database.query("UPDATE provider_recommendations SET moderation_status=$2,moderated_at=now(),moderated_by=$3 WHERE id::text=$1 RETURNING id",[id,status,session.user.id]);if(!updated.rowCount)return NextResponse.json({error:"Recommendation not found."},{status:404});
  await recordActivity({userId:session.user.id,action:`client_recommendation_${status}`,targetType:"provider_recommendation",targetId:id});
  return NextResponse.json({ok:true});
}
