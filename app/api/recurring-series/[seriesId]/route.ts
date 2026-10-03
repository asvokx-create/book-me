import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { refundUnreleasedBooking } from "@/lib/payment-release";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function PATCH(request: Request, context: RouteContext<"/api/recurring-series/[seriesId]">) {
  const session=await auth.api.getSession({headers:await headers()});
  if(!session)return NextResponse.json({error:"Not signed in."},{status:401});
  if(!await enforceRateLimit({request,userId:session.user.id,bucket:"recurring-series-change",limit:8}))return NextResponse.json({error:"Too many changes. Please wait a minute."},{status:429});
  const {seriesId}=await context.params; const body=await request.json() as {action?:unknown;reason?:unknown}; const reason=typeof body.reason==="string"?body.reason.trim():"";
  if(body.action!=="cancel"||reason.length<3||reason.length>500)return NextResponse.json({error:"Add a brief cancellation reason."},{status:400});
  const safety=await checkAndRecordContent({userId:session.user.id,surface:"booking_cancellation",fields:[reason]}); if(!safety.allowed)return NextResponse.json({error:safety.message},{status:422});
  const client=await database.connect(); let refundable:string[]=[];
  try{await client.query("BEGIN");const series=await client.query<{id:string}>(`SELECT series.id::text FROM recurring_booking_series series JOIN provider_profiles provider ON provider.id=series.provider_id WHERE series.id::text=$1 AND (series.customer_id=$2 OR provider.user_id=$2) AND series.status IN ('pending','active','paused') FOR UPDATE OF series`,[seriesId,session.user.id]);if(!series.rows[0]){await client.query("ROLLBACK");return NextResponse.json({error:"Recurring series not found or already closed."},{status:404});}
    await client.query(`UPDATE recurring_booking_series SET status='cancelled',cancelled_at=now(),cancelled_by=$2,cancellation_reason=$3 WHERE id::text=$1`,[seriesId,session.user.id,reason]);
    const cancelled=await client.query<{id:string;payment_status:string}>(`UPDATE bookings SET status='cancelled',cancelled_by=CASE WHEN customer_id=$2 THEN 'customer' ELSE 'provider' END,cancellation_reason=$3 WHERE recurring_series_id::text=$1 AND starts_at>now() AND status IN ('requested','confirmed') RETURNING id::text,payment_status`,[seriesId,session.user.id,reason]);refundable=cancelled.rows.filter((item)=>item.payment_status==="paid").map((item)=>item.id);
    await client.query(`INSERT INTO notifications (user_id,type,title,message,href,dedupe_key) SELECT DISTINCT recipient,'recurring_cancelled','Recurring bookings cancelled',$3,'/account','recurring-series-cancelled-'||$1||'-'||recipient FROM (SELECT customer_id AS recipient FROM recurring_booking_series WHERE id::text=$1 UNION SELECT provider.user_id FROM recurring_booking_series series JOIN provider_profiles provider ON provider.id=series.provider_id WHERE series.id::text=$1) recipients ON CONFLICT(dedupe_key) DO NOTHING`,[seriesId,session.user.id,`Future recurring visits were cancelled: ${reason}`]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");console.error("Recurring cancellation failed",error);return NextResponse.json({error:"We could not cancel the recurring bookings."},{status:500});}finally{client.release();}
  const warnings=[];for(const bookingId of refundable){const result=await refundUnreleasedBooking(bookingId,"Recurring series cancelled before the future occurrence.");if(!result.ok)warnings.push(bookingId);}await recordActivity({userId:session.user.id,action:"recurring_series_cancelled",targetType:"recurring_series",targetId:seriesId});return NextResponse.json({ok:true,refundWarnings:warnings.length});
}

