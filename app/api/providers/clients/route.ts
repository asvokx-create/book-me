import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { enforceRateLimit,recordActivity } from "@/lib/request-security";
import { cleanText,getMarketingAccess,listProviderClients,type ClientFilters } from "@/lib/provider-marketing";

function filters(url:URL):ClientFilters{return {search:url.searchParams.get("search")||undefined,tagId:url.searchParams.get("tag")||undefined,serviceId:url.searchParams.get("service")||undefined,category:url.searchParams.get("category")||undefined,bookingState:(url.searchParams.get("state")||undefined) as ClientFilters["bookingState"],marketing:(url.searchParams.get("marketing")||undefined) as ClientFilters["marketing"],minSpent:Number(url.searchParams.get("minSpent")||0)*100||undefined,minBookings:Number(url.searchParams.get("minBookings")||0)||undefined,lastBookingDays:Number(url.searchParams.get("days")||0)||undefined,sort:url.searchParams.get("sort")||undefined};}

async function eligible(providerId:string,customerId:string){const result=await database.query("SELECT 1 FROM bookings WHERE provider_id::text=$1 AND customer_id=$2 AND provider_deleted_at IS NULL AND status IN('requested','confirmed','completed','cancelled') LIMIT 1",[providerId,customerId]);return Boolean(result.rows[0]);}

export async function GET(request:Request){
  const access=await getMarketingAccess("view");if(!access)return NextResponse.json({error:"Client access is not available for this account."},{status:403});
  const url=new URL(request.url);const customerId=url.searchParams.get("customerId");
  if(customerId){
    if(!await eligible(access.providerId,customerId))return NextResponse.json({error:"Client not found."},{status:404});
    const [client,bookings,quotes,notes,reviews,events,tags,allTags]=await Promise.all([
      listProviderClients(access.providerId,{customerId},1,0).then(r=>r.rows[0]),
      database.query(`SELECT b.id::text,b.status,b.starts_at,b.created_at,b.price_cents,b.refunded_amount_cents,
        b.pricing_type_snapshot,b.hourly_rate_cents_snapshot,b.billable_duration_minutes,b.base_price_cents,
        b.package_snapshot,b.add_on_snapshot,b.coupon_code_snapshot,b.recurring_series_id::text,s.title service,s.category
        FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.provider_id::text=$1 AND b.customer_id=$2 ORDER BY b.created_at DESC LIMIT 100`,[access.providerId,customerId]),
      database.query(`SELECT q.id::text,q.status,q.amount_cents,q.created_at,r.title FROM quotes q JOIN job_requests r ON r.id=q.request_id WHERE q.provider_id::text=$1 AND r.customer_id=$2 ORDER BY q.created_at DESC LIMIT 50`,[access.providerId,customerId]),
      database.query(`SELECT n.id::text,n.body,n.created_at,u.name author FROM provider_client_notes n LEFT JOIN "user" u ON u.id=n.author_user_id WHERE n.provider_id::text=$1 AND n.customer_id=$2 ORDER BY n.created_at DESC`,[access.providerId,customerId]),
      database.query(`SELECT r.id::text,r.rating,r.body,r.created_at,s.title service FROM reviews r JOIN bookings b ON b.id=r.booking_id JOIN services s ON s.id=b.service_id WHERE b.provider_id::text=$1 AND b.customer_id=$2 ORDER BY r.created_at DESC`,[access.providerId,customerId]),
      database.query(`SELECT c.name campaign,e.event_type,e.created_at FROM marketing_email_events e JOIN marketing_campaign_recipients r ON r.id=e.recipient_id JOIN marketing_campaigns c ON c.id=r.campaign_id WHERE e.provider_id::text=$1 AND r.customer_id=$2 ORDER BY e.created_at DESC LIMIT 100`,[access.providerId,customerId]),
      database.query(`SELECT t.id::text,t.name,t.color FROM provider_client_tag_assignments a JOIN provider_client_tags t ON t.id=a.tag_id WHERE a.provider_id::text=$1 AND a.customer_id=$2 ORDER BY t.name`,[access.providerId,customerId]),
      database.query(`SELECT id::text,name,color FROM provider_client_tags WHERE provider_id::text=$1 ORDER BY name`,[access.providerId])
    ]);
    return NextResponse.json({client,bookings:bookings.rows,quotes:quotes.rows,notes:notes.rows,reviews:reviews.rows,events:events.rows,tags:tags.rows,allTags:allTags.rows});
  }
  const page=Math.max(1,Number(url.searchParams.get("page")||1));const result=await listProviderClients(access.providerId,filters(url),50,(page-1)*50);
  const [tags,services]=await Promise.all([database.query(`SELECT id::text,name,color FROM provider_client_tags WHERE provider_id::text=$1 ORDER BY name`,[access.providerId]),database.query(`SELECT id::text,title,category FROM services WHERE provider_id::text=$1 AND is_active=true ORDER BY title`,[access.providerId])]);
  return NextResponse.json({clients:result.rows,total:Number((result.rows[0] as {total_count?:number}|undefined)?.total_count??0),page,pageSize:50,tags:tags.rows,services:services.rows});
}

export async function POST(request:Request){
  const access=await getMarketingAccess("clients");if(!access)return NextResponse.json({error:"You do not have permission to update clients."},{status:403});
  if(!await enforceRateLimit({request,userId:access.session.user.id,bucket:"provider-client-change",limit:40}))return NextResponse.json({error:"Too many client changes. Please wait."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return NextResponse.json({error:"Enter valid client details."},{status:400});
  const action=body.action;const customerId=typeof body.customerId==="string"?body.customerId:"";
  if(action!=="tag_create"&&(!customerId||!await eligible(access.providerId,customerId)))return NextResponse.json({error:"Client not found."},{status:404});
  if(action==="note_create"){
    const note=cleanText(body.note,2000);if(!note)return NextResponse.json({error:"Write a note first."},{status:400});
    const result=await database.query<{id:string}>(`INSERT INTO provider_client_notes(provider_id,customer_id,author_user_id,body) VALUES($1,$2,$3,$4) RETURNING id::text`,[access.providerId,customerId,access.session.user.id,note]);await recordActivity({userId:access.session.user.id,action:"provider_client_note_created",targetType:"customer",targetId:customerId});return NextResponse.json({id:result.rows[0].id},{status:201});
  }
  if(action==="tag_create"){
    const name=cleanText(body.name,40);const color=["sage","yellow","blue","plum","orange","gray"].includes(String(body.color))?String(body.color):"sage";if(!name)return NextResponse.json({error:"Name the tag."},{status:400});
    try{const result=await database.query<{id:string}>(`INSERT INTO provider_client_tags(provider_id,name,color,created_by) VALUES($1,$2,$3,$4) RETURNING id::text`,[access.providerId,name,color,access.session.user.id]);return NextResponse.json({id:result.rows[0].id},{status:201});}catch(error){if((error as {code?:string}).code==="23505")return NextResponse.json({error:"That tag already exists."},{status:409});throw error;}
  }
  if(action==="tag_assign"){
    const tagId=typeof body.tagId==="string"?body.tagId:"";const owns=await database.query("SELECT 1 FROM provider_client_tags WHERE id::text=$1 AND provider_id::text=$2",[tagId,access.providerId]);if(!owns.rows[0])return NextResponse.json({error:"Tag not found."},{status:404});
    await database.query(`INSERT INTO provider_client_tag_assignments(provider_id,customer_id,tag_id,assigned_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[access.providerId,customerId,tagId,access.session.user.id]);return NextResponse.json({ok:true});
  }
  if(action==="tag_remove"){await database.query(`DELETE FROM provider_client_tag_assignments WHERE provider_id::text=$1 AND customer_id=$2 AND tag_id::text=$3`,[access.providerId,customerId,String(body.tagId||"")]);return NextResponse.json({ok:true});}
  return NextResponse.json({error:"Unsupported client change."},{status:400});
}
