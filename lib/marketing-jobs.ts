import "server-only";
import { database } from "./database";
import { emailHash,isMarketingConfigured,renderCampaignEmail,sendMarketingEmail,type CampaignContent } from "./provider-marketing";

type QueueRow={id:string;campaign_id:string;provider_id:string;customer_id:string;email:string;display_name:string;personalization:Record<string,string>;subject:string;content:CampaignContent;business_name:string;reply_to:string};

export async function runMarketingCampaignBatch(batchSize=40){
  if(!isMarketingConfigured())return {processed:0,sent:0,suppressed:0,failed:0,configured:false};
  await database.query(`UPDATE marketing_campaigns SET status='sending',sending_started_at=COALESCE(sending_started_at,now()) WHERE status='scheduled' AND scheduled_at<=now()`);
  await database.query(`UPDATE marketing_campaign_recipients SET status='queued',next_attempt_at=now(),last_error='Recovered an interrupted send attempt.' WHERE status='sending' AND next_attempt_at<now()-interval '10 minutes'`);
  const client=await database.connect();let rows:QueueRow[]=[];
  try{await client.query("BEGIN");const claimed=await client.query<QueueRow>(`SELECT r.id::text,r.campaign_id::text,r.provider_id::text,r.customer_id,r.email,r.display_name,r.personalization,c.subject,c.content,p.business_name,u.email reply_to FROM marketing_campaign_recipients r JOIN marketing_campaigns c ON c.id=r.campaign_id AND c.status='sending' JOIN provider_profiles p ON p.id=r.provider_id JOIN "user" u ON u.id=p.user_id LEFT JOIN provider_marketing_access a ON a.provider_id=p.id WHERE r.status='queued' AND r.next_attempt_at<=now() AND COALESCE(a.status,'enabled')='enabled' ORDER BY c.scheduled_at,r.created_at FOR UPDATE OF r SKIP LOCKED LIMIT $1`,[Math.min(Math.max(batchSize,1),100)]);rows=claimed.rows;if(rows.length)await client.query(`UPDATE marketing_campaign_recipients SET status='sending',attempt_count=attempt_count+1 WHERE id=ANY($1::uuid[])`,[rows.map(r=>r.id)]);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  let sent=0,suppressed=0,failed=0;
  for(const row of rows){
    const blocked=await database.query(`SELECT 1 FROM provider_marketing_preferences pref WHERE pref.provider_id::text=$1 AND pref.customer_id=$2 AND pref.status='unsubscribed' UNION ALL SELECT 1 FROM marketing_suppressions s WHERE s.email_hash=$3 AND (s.provider_id IS NULL OR s.provider_id::text=$1) LIMIT 1`,[row.provider_id,row.customer_id,emailHash(row.email)]);
    const campaignActive=await database.query(`SELECT 1 FROM marketing_campaigns WHERE id::text=$1 AND provider_id::text=$2 AND status='sending'`,[row.campaign_id,row.provider_id]);
    if(blocked.rows[0]||!campaignActive.rows[0]){await database.query(`UPDATE marketing_campaign_recipients SET status=$2,last_error=$3 WHERE id::text=$1 AND status='sending'`,[row.id,blocked.rows[0]?"suppressed":"cancelled",blocked.rows[0]?"Suppression rechecked before delivery.":"Campaign stopped before delivery."]);suppressed++;continue;}
    const p=row.personalization??{};const rendered=renderCampaignEmail({content:row.content,subject:row.subject,businessName:row.business_name,recipient:{id:row.id,providerId:row.provider_id,campaignId:row.campaign_id,firstName:p.firstName||row.display_name.split(" ")[0],lastService:p.lastService||"",lastBookingDate:p.lastBookingDate?new Date(p.lastBookingDate).toLocaleDateString():"",serviceSlug:p.serviceSlug||""}});
    const result=await sendMarketingEmail({to:row.email,fromName:row.business_name,replyTo:row.reply_to,subject:rendered.subject,html:rendered.html.replace("CLICK_URL",rendered.clickUrl),unsubscribeUrl:rendered.unsubscribeUrl,idempotencyKey:`campaign-${row.campaign_id}-recipient-${row.id}`});
    if(result.sent){await database.query(`UPDATE marketing_campaign_recipients SET status='sent',provider_message_id=$2,sent_at=now(),last_error='' WHERE id::text=$1`,[row.id,result.id]);await database.query(`INSERT INTO marketing_email_events(recipient_id,provider_id,event_type,metadata) VALUES($1,$2,'sent','{}')`,[row.id,row.provider_id]);sent++;}
    else{await database.query(`UPDATE marketing_campaign_recipients SET status=CASE WHEN attempt_count>=3 THEN 'failed' ELSE 'queued' END,next_attempt_at=now()+(interval '5 minutes'*GREATEST(attempt_count,1)),last_error=$2 WHERE id::text=$1`,[row.id,result.error?.slice(0,500)||"Delivery failed."]);failed++;}
  }
  await database.query(`UPDATE marketing_campaigns c SET status=CASE WHEN EXISTS(SELECT 1 FROM marketing_campaign_recipients r WHERE r.campaign_id=c.id AND r.status IN('queued','sending')) THEN c.status ELSE 'sent' END,sent_at=CASE WHEN NOT EXISTS(SELECT 1 FROM marketing_campaign_recipients r WHERE r.campaign_id=c.id AND r.status IN('queued','sending')) THEN COALESCE(c.sent_at,now()) ELSE c.sent_at END WHERE c.status='sending'`);
  return {processed:rows.length,sent,suppressed,failed,configured:true};
}
