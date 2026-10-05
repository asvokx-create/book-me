import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { database } from "./database";
import { getProviderAccess } from "./provider-access";

export type ClientFilters={customerId?:string;search?:string;tagId?:string;serviceId?:string;category?:string;bookingState?:"repeat"|"one_time"|"upcoming"|"inactive";marketing?:"subscribed"|"unsubscribed"|"never_emailed";minSpent?:number;minBookings?:number;lastBookingDays?:number;sort?:string};
export type CampaignContent={title:string;body:string;buttonText:string;buttonUrl:string;color?:string;imageUrl?:string};

const appUrl=process.env.NEXT_PUBLIC_APP_URL??process.env.BETTER_AUTH_URL??"http://localhost:3000";
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getMarketingAccess(mode:"view"|"clients"|"manage"|"send"="view"){
  const access=await getProviderAccess();
  if(!access)return null;
  if(access.isOwner)return access;
  const permission=mode==="view"?"can_view_clients":mode==="clients"?"can_manage_clients":mode==="manage"?"can_manage_campaigns":"can_send_campaigns";
  const allowed=await database.query(`SELECT 1 FROM provider_team_members WHERE id::text=$1 AND provider_id::text=$2 AND status='active' AND ${permission}=true`,[access.memberId,access.providerId]);
  return allowed.rows[0]?access:null;
}

export function cleanText(value:unknown,max:number){return typeof value==="string"?value.replace(/[<>]/g,"").trim().slice(0,max):"";}
export function validMarketingEmail(email:string){return emailPattern.test(email)&&email.length<=254;}
export function emailHash(email:string){return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");}

function marketingApiKey(){return process.env.RESEND_MARKETING_API_KEY??process.env.RESEND_API_KEY??"";}
function marketingEmailFrom(){const configured=(process.env.MARKETING_EMAIL_FROM??process.env.EMAIL_FROM??"").trim();const mailbox=configured.match(/<([^<>]+)>\s*$/)?.[1]?.trim();return mailbox??configured;}
function tokenSecret(){const dedicated=process.env.MARKETING_TOKEN_SECRET??"";if(dedicated)return dedicated;const shared=process.env.BETTER_AUTH_SECRET??"";return shared?createHmac("sha256",shared).update("bubsbookings-marketing-token-v1").digest("hex"):"";}
export function signedMarketingToken(payload:Record<string,string>,days=365){
  const body=Buffer.from(JSON.stringify({...payload,exp:String(Date.now()+days*86400000)})).toString("base64url");
  const signature=createHmac("sha256",tokenSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}
export function readMarketingToken(token:string){
  try{const [body,signature]=token.split(".");if(!body||!signature||!tokenSecret())return null;const expected=createHmac("sha256",tokenSecret()).update(body).digest();const actual=Buffer.from(signature,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const parsed=JSON.parse(Buffer.from(body,"base64url").toString()) as Record<string,string>;return Number(parsed.exp)>Date.now()?parsed:null;}catch{return null;}
}

export function clientOrder(sort="recent"){
  return ({name:"display_name ASC",newest:"first_booking_at DESC",oldest:"first_booking_at ASC",oldest_last:"last_booking_at ASC",most_bookings:"booking_count DESC",fewest_bookings:"booking_count ASC",highest_value:"total_spent_cents DESC",lowest_value:"total_spent_cents ASC",recent_contact:"last_marketing_at DESC NULLS LAST",least_contact:"last_marketing_at ASC NULLS FIRST"} as Record<string,string>)[sort]??"last_booking_at DESC";
}

export async function listProviderClients(providerId:string,filters:ClientFilters={},limit=50,offset=0){
  const values:unknown[]=[providerId];const where=["true"];
  const add=(clause:string,value:unknown)=>{values.push(value);where.push(clause.replace("?",`$${values.length}`));};
  if(filters.customerId)add("customer_id=?",filters.customerId);
  if(filters.search){const term=`%${filters.search.slice(0,100)}%`;values.push(term);const slot=`$${values.length}`;where.push(`(lower(display_name) LIKE lower(${slot}) OR lower(email) LIKE lower(${slot}) OR lower(service_titles) LIKE lower(${slot}) OR EXISTS(SELECT 1 FROM provider_client_notes n WHERE n.provider_id::text=$1 AND n.customer_id=client.customer_id AND lower(n.body) LIKE lower(${slot})))`);}
  if(filters.serviceId)add("?=ANY(service_ids)",filters.serviceId);
  if(filters.category)add("?=ANY(categories)",filters.category);
  if(filters.tagId)add("EXISTS(SELECT 1 FROM provider_client_tag_assignments a WHERE a.provider_id::text=$1 AND a.customer_id=client.customer_id AND a.tag_id::text=?)",filters.tagId);
  if(filters.minSpent)add("total_spent_cents>=?",Math.max(0,filters.minSpent));
  if(filters.minBookings)add("booking_count>=?",Math.max(1,filters.minBookings));
  if(filters.lastBookingDays)add("last_booking_at>=now()-(?::int*interval '1 day')",filters.lastBookingDays);
  if(filters.bookingState==="repeat")where.push("booking_count>1");
  if(filters.bookingState==="one_time")where.push("booking_count=1");
  if(filters.bookingState==="upcoming")where.push("upcoming_booking_at IS NOT NULL");
  if(filters.bookingState==="inactive")where.push("last_booking_at<now()-interval '90 days'");
  if(filters.marketing==="unsubscribed")where.push("marketing_status='unsubscribed'");
  if(filters.marketing==="subscribed")where.push("marketing_status='subscribed'");
  if(filters.marketing==="never_emailed")where.push("last_marketing_at IS NULL");
  values.push(Math.min(Math.max(limit,1),5000),Math.max(offset,0));
  const query=`WITH activity AS (
    SELECT b.customer_id,min(b.created_at) first_booking_at,max(b.created_at) last_booking_at,count(*)::int booking_count,
      count(*) FILTER(WHERE b.status='completed')::int completed_bookings,count(*) FILTER(WHERE b.status='cancelled')::int cancelled_bookings,
      COALESCE(sum(GREATEST(0,b.price_cents-b.refunded_amount_cents)) FILTER(WHERE b.status='completed'),0)::bigint total_spent_cents,
      min(b.starts_at) FILTER(WHERE b.starts_at>now() AND b.status IN('requested','confirmed')) upcoming_booking_at,
      array_agg(DISTINCT s.id::text) service_ids,array_agg(DISTINCT s.category) categories,string_agg(DISTINCT s.title,', ') service_titles,
      (array_agg(s.title ORDER BY b.starts_at DESC))[1] last_service,
      (array_agg(s.slug ORDER BY b.starts_at DESC))[1] last_service_slug,
      bool_or(b.recurring_series_id IS NOT NULL) recurring_customer
    FROM bookings b JOIN services s ON s.id=b.service_id
    WHERE b.provider_id::text=$1 AND b.provider_deleted_at IS NULL AND b.status IN('requested','confirmed','completed','cancelled')
    GROUP BY b.customer_id
  ), client AS (
    SELECT activity.*,u.name display_name,u.email,u.image,
      COALESCE(pref.status,'subscribed') marketing_status,
      (SELECT max(r.sent_at) FROM marketing_campaign_recipients r WHERE r.provider_id::text=$1 AND r.customer_id=activity.customer_id) last_marketing_at,
      (SELECT json_agg(json_build_object('id',t.id::text,'name',t.name,'color',t.color) ORDER BY t.name) FROM provider_client_tag_assignments a JOIN provider_client_tags t ON t.id=a.tag_id WHERE a.provider_id::text=$1 AND a.customer_id=activity.customer_id) tags
    FROM activity JOIN "user" u ON u.id=activity.customer_id LEFT JOIN provider_marketing_preferences pref ON pref.provider_id::text=$1 AND pref.customer_id=activity.customer_id
  ) SELECT *,count(*) OVER()::int total_count FROM client WHERE ${where.join(" AND ")} ORDER BY ${clientOrder(filters.sort)} LIMIT $${values.length-1} OFFSET $${values.length}`;
  return database.query(query,values);
}

export function mergeContent(value:string,data:Record<string,string>){return value.replace(/\{\{([a-z_]+)\}\}/g,(_,key:string)=>data[key]??"");}
function escape(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);}
export function renderCampaignEmail(input:{content:CampaignContent;subject:string;businessName:string;recipient:{id:string;providerId:string;campaignId:string;firstName:string;lastService:string;lastBookingDate:string;serviceSlug:string}}){
  const unsubscribeToken=signedMarketingToken({r:input.recipient.id,p:input.recipient.providerId,c:input.recipient.campaignId});
  const clickToken=signedMarketingToken({r:input.recipient.id,p:input.recipient.providerId,c:input.recipient.campaignId},30);
  const unsubscribeUrl=`${appUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const destination=new URL(input.content.buttonUrl||`/services/${input.recipient.serviceSlug}`,appUrl);destination.searchParams.set("campaign",clickToken);
  const data={first_name:input.recipient.firstName||"there",provider_name:input.businessName,business_name:input.businessName,last_service:input.recipient.lastService||"your previous service",last_booking_date:input.recipient.lastBookingDate||"",service_name:input.recipient.lastService||"our services",provider_profile_url:appUrl,book_again_url:destination.toString(),unsubscribe_url:unsubscribeUrl};
  const title=escape(mergeContent(input.content.title,data));const body=escape(mergeContent(input.content.body,data)).replace(/\n/g,"<br>");const button=escape(mergeContent(input.content.buttonText,data));
  return {subject:mergeContent(input.subject,data),unsubscribeUrl,clickUrl:`${appUrl}/api/marketing/click?token=${encodeURIComponent(clickToken)}&to=${encodeURIComponent(destination.pathname+destination.search.replace(/([?&])campaign=[^&]+&?/,"$1").replace(/[?&]$/, ""))}`,html:`<!doctype html><html><body style="margin:0;background:#f4f4ef;font-family:Arial,sans-serif;color:#183126"><div style="max-width:620px;margin:auto;padding:28px 14px"><div style="background:#fff;border:1px solid #dfe5df;border-radius:24px;overflow:hidden"><div style="height:8px;background:${/^#[0-9a-f]{6}$/i.test(input.content.color??"")?input.content.color:"#183126"}"></div><div style="padding:32px"><p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escape(input.businessName)} via BubsBookings</p><h1 style="font-size:30px;line-height:1.15;margin:24px 0 14px">${title}</h1><p style="font-size:16px;line-height:1.65;color:#52665b">${body}</p><p style="margin:28px 0"><a href="CLICK_URL" style="display:inline-block;background:#eee25a;color:#183126;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">${button||"View services"}</a></p><p style="font-size:12px;line-height:1.55;color:#718078;border-top:1px solid #e4e8e4;padding-top:22px">You received this because you booked with ${escape(input.businessName)} through BubsBookings. <a href="${escape(unsubscribeUrl)}">Unsubscribe from this provider's marketing emails</a>. Booking, payment, security, and other required service messages are separate.</p></div></div></div></body></html>`};
}

export function isMarketingConfigured(){return Boolean(marketingApiKey()&&validMarketingEmail(marketingEmailFrom())&&tokenSecret());}
export async function sendMarketingEmail(input:{to:string;fromName:string;subject:string;html:string;unsubscribeUrl:string;idempotencyKey:string;replyTo?:string}){
  if(!isMarketingConfigured())return {sent:false,error:"Marketing email infrastructure is not configured."};
  const oneClickUrl=input.unsubscribeUrl.replace("/unsubscribe?","/api/marketing/unsubscribe?");
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${marketingApiKey()}`,"Content-Type":"application/json","Idempotency-Key":input.idempotencyKey},body:JSON.stringify({from:`${input.fromName.replace(/[<>]/g,"")} via BubsBookings <${marketingEmailFrom()}>`,to:[input.to],subject:input.subject,html:input.html,reply_to:input.replyTo||undefined,headers:{"List-Unsubscribe":`<${oneClickUrl}>`,"List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}})});
  const result=await response.json().catch(()=>({})) as {id?:string;message?:string};return response.ok?{sent:true,id:result.id??""}:{sent:false,error:result.message??`Email provider returned ${response.status}.`};
}
