import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { getProviderAccess } from "@/lib/provider-access";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { checkAndRecordContent } from "@/lib/content-safety";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { recordAnalytics } from "@/lib/analytics";
import { sendTransactionalEmail } from "@/lib/email";

async function owner(){const access=await getProviderAccess();return access?.isOwner?access:null;}
async function providerPlan(providerId:string){
  const profile=await database.query<{plan:ProviderPlan}>("SELECT plan FROM provider_profiles WHERE id::text=$1",[providerId]);
  return profile.rows[0]?.plan??"starter";
}

export async function GET(){
  const access=await owner();
  if(!access)return NextResponse.json({error:"Only the business owner can view customer history."},{status:403});
  const plan=await providerPlan(access.providerId);
  if(!PLAN_ENTITLEMENTS[plan].repeatCustomerTools)return NextResponse.json({allowed:false,customers:[]});
  const result=await database.query<{
    customer_id:string;display_name:string;image:string|null;completed_bookings:number;total_booking_cents:string;
    last_booking_at:Date;service_id:string;service_title:string;service_slug:string;last_offer_at:Date|null;
  }>(`WITH ranked AS (
      SELECT booking.*,service.title AS service_title,service.slug AS service_slug,
        row_number() OVER(PARTITION BY booking.customer_id ORDER BY booking.starts_at DESC,booking.created_at DESC) AS rank
      FROM bookings booking JOIN services service ON service.id=booking.service_id
      WHERE booking.provider_id::text=$1 AND booking.status='completed' AND booking.provider_deleted_at IS NULL
    ), totals AS (
      SELECT customer_id,count(*)::int AS completed_bookings,
        COALESCE(sum(price_cents-refunded_amount_cents),0)::bigint AS total_booking_cents,max(starts_at) AS last_booking_at
      FROM bookings WHERE provider_id::text=$1 AND status='completed' AND provider_deleted_at IS NULL GROUP BY customer_id
    )
    SELECT totals.customer_id,user_account.name AS display_name,user_account.image,totals.completed_bookings,
      totals.total_booking_cents,totals.last_booking_at,ranked.service_id::text,ranked.service_title,ranked.service_slug,
      (SELECT max(offer.created_at) FROM provider_repeat_offers offer WHERE offer.provider_id::text=$1 AND offer.customer_id=totals.customer_id) AS last_offer_at
    FROM totals JOIN ranked ON ranked.customer_id=totals.customer_id AND ranked.rank=1
    JOIN "user" user_account ON user_account.id=totals.customer_id ORDER BY totals.last_booking_at DESC LIMIT 250`,[access.providerId]);
  return NextResponse.json({allowed:true,customers:result.rows.map(row=>({customerId:row.customer_id,displayName:row.display_name,image:row.image??"",completedBookings:row.completed_bookings,totalBookingValue:Number(row.total_booking_cents)/100,lastBookingAt:row.last_booking_at,serviceId:row.service_id,serviceTitle:row.service_title,serviceSlug:row.service_slug,lastOfferAt:row.last_offer_at,offerAllowed:!row.last_offer_at||Date.now()-row.last_offer_at.getTime()>=30*86400000}))});
}

export async function POST(request:Request){
  const access=await owner();
  if(!access)return NextResponse.json({error:"Only the business owner can send a repeat-booking offer."},{status:403});
  if(!await enforceRateLimit({request,userId:access.session.user.id,bucket:"provider-repeat-offer",limit:3,windowSeconds:3600}))return NextResponse.json({error:"You can send up to three repeat offers per hour."},{status:429});
  const body=await request.json().catch(()=>null) as {customerId?:unknown;serviceId?:unknown;message?:unknown}|null;
  const customerId=typeof body?.customerId==="string"?body.customerId:"";
  const serviceId=typeof body?.serviceId==="string"?body.serviceId:"";
  const message=typeof body?.message==="string"?body.message.trim():"";
  if(!customerId||!serviceId||message.length<10||message.length>1000)return NextResponse.json({error:"Choose a past customer and write a message between 10 and 1,000 characters."},{status:400});
  const plan=await providerPlan(access.providerId);
  if(!PLAN_ENTITLEMENTS[plan].repeatCustomerTools)return NextResponse.json({error:"Repeat-customer offers require Pro."},{status:403});
  const safety=await checkAndRecordContent({userId:access.session.user.id,surface:"message",fields:[message]});
  if(!safety.allowed)return NextResponse.json({error:safety.message},{status:422});
  const client=await database.connect();let conversationId="";let messageId="";
  try{
    await client.query("BEGIN");
    const eligible=await client.query<{email:string;notifications:boolean}>(`SELECT customer.email,COALESCE(settings.message_notifications,true) AS notifications FROM bookings booking JOIN services service ON service.id=booking.service_id JOIN "user" customer ON customer.id=booking.customer_id LEFT JOIN user_settings settings ON settings.user_id=customer.id WHERE booking.provider_id::text=$1 AND booking.customer_id=$2 AND booking.service_id::text=$3 AND booking.status='completed' AND service.is_active=true LIMIT 1`,[access.providerId,customerId,serviceId]);
    if(!eligible.rows[0]){await client.query("ROLLBACK");return NextResponse.json({error:"This repeat offer is not available for that customer and service."},{status:404});}
    const recent=await client.query("SELECT 1 FROM provider_repeat_offers WHERE provider_id::text=$1 AND customer_id=$2 AND created_at>now()-interval '30 days' LIMIT 1",[access.providerId,customerId]);
    if(recent.rows[0]){await client.query("ROLLBACK");return NextResponse.json({error:"A repeat offer was already sent to this customer in the last 30 days."},{status:409});}
    const conversation=await client.query<{id:string}>(`INSERT INTO conversations(customer_id,provider_id,service_id) VALUES($1,$2,$3) ON CONFLICT(customer_id,provider_id,service_id) WHERE service_id IS NOT NULL DO UPDATE SET provider_deleted_at=NULL,customer_deleted_at=NULL,updated_at=now() RETURNING id::text`,[customerId,access.providerId,serviceId]);
    conversationId=conversation.rows[0].id;
    const created=await client.query<{id:string}>("INSERT INTO messages(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING id::text",[conversationId,access.session.user.id,message]);
    messageId=created.rows[0].id;
    await client.query("INSERT INTO provider_repeat_offers(provider_id,customer_id,service_id,conversation_id,message_id) VALUES($1,$2,$3,$4,$5)",[access.providerId,customerId,serviceId,conversationId,messageId]);
    await client.query(`INSERT INTO notifications(user_id,type,title,message,href,dedupe_key) VALUES($1,'repeat_offer','A provider invited you to book again',$2,$3,$4) ON CONFLICT(dedupe_key) DO NOTHING`,[customerId,"Open the secure message to review the offer.",`/account/messages?conversationId=${conversationId}`,`repeat-offer-${messageId}`]);
    await client.query("COMMIT");
    await Promise.all([recordActivity({userId:access.session.user.id,action:"repeat_booking_offer_sent",targetType:"conversation",targetId:conversationId}),recordAnalytics({eventName:"repeat_offer_sent",userId:access.session.user.id,targetType:"service",targetId:serviceId})]);
    if(eligible.rows[0].notifications)await sendTransactionalEmail({to:eligible.rows[0].email,userId:customerId,emailType:`repeat-offer-${messageId}`,subject:"A provider invited you to book again",heading:"Ready to book again?",message:"A provider you previously booked sent you a private repeat-booking message. Sign in to review it; pricing and availability are confirmed when you make a new booking.",actionLabel:"Read the message",actionUrl:`/account/messages?conversationId=${conversationId}`});
    return NextResponse.json({conversationId},{status:201});
  }catch(error){
    await client.query("ROLLBACK");console.error("Repeat offer failed",error);return NextResponse.json({error:"We could not send this offer."},{status:500});
  }finally{client.release();}
}
