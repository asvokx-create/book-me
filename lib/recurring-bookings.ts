import "server-only";
import { database } from "./database";
import { calculateBookingFinancialSnapshot, type BookingFinancialPlan } from "./booking-financials";
import { nextOccurrence, type RecurrenceOption } from "./service-commerce";
import { sendBookingUpdateEmails } from "./booking-email";

type DueSeries = { id:string; customer_id:string; provider_id:string; provider_user_id:string; service_id:string; service_title:string; frequency:Exclude<RecurrenceOption,"one_time">; next_occurrence_at:Date; plan:BookingFinancialPlan };
type RecurringSourceBooking = {
  id:string;
  starts_at:Date;
  ends_at:Date;
  duration_minutes:string | number;
  service_address:string;
  service_address_line1:string | null;
  service_address_line2:string | null;
  service_city:string | null;
  service_state:string | null;
  service_postal_code:string | null;
  access_instructions:string;
  notes:string;
  booking_answers:Record<string,string>;
  delivery_method:"IN_PERSON" | "REMOTE";
  base_price_cents:number;
  add_on_total_cents:number;
  package_snapshot:unknown;
  add_on_snapshot:unknown;
  recurrence_index:number | null;
  booking_kind:"service" | "consultation" | "milestone";
  pricing_type_snapshot:"FIXED" | "HOURLY";
  hourly_rate_cents_snapshot:number | null;
  billable_duration_minutes:number;
  billing_increment_minutes_snapshot:number | null;
  minimum_duration_minutes_snapshot:number | null;
  maximum_duration_minutes_snapshot:number | null;
};

export async function generateDueRecurringBookings(limit=50){
  const due=await database.query<DueSeries>(`SELECT series.id::text,series.customer_id,series.provider_id::text,provider.user_id AS provider_user_id,series.service_id::text,service.title AS service_title,series.frequency,series.next_occurrence_at,provider.plan FROM recurring_booking_series series JOIN provider_profiles provider ON provider.id=series.provider_id JOIN services service ON service.id=series.service_id WHERE series.status='active' AND series.next_occurrence_at<=now()+interval '30 days' AND NOT EXISTS(SELECT 1 FROM bookings future WHERE future.recurring_series_id=series.id AND future.starts_at>=series.next_occurrence_at AND future.status IN ('requested','confirmed')) ORDER BY series.next_occurrence_at LIMIT $1`,[limit]);
  let created=0;const paused:string[]=[];
  for(const series of due.rows){const client=await database.connect();let bookingId="";try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`recurring-series:${series.id}`]);const locked=await client.query<{next_occurrence_at:Date;frequency:Exclude<RecurrenceOption,"one_time">}>("SELECT next_occurrence_at,frequency FROM recurring_booking_series WHERE id::text=$1 AND status='active' FOR UPDATE",[series.id]);if(!locked.rows[0]){await client.query("ROLLBACK");continue;}const prior=await client.query<RecurringSourceBooking>(`SELECT booking.*,EXTRACT(EPOCH FROM (booking.ends_at-booking.starts_at))/60 AS duration_minutes FROM bookings booking WHERE booking.recurring_series_id::text=$1 ORDER BY booking.recurrence_index DESC LIMIT 1`,[series.id]);const source=prior.rows[0];if(!source){await client.query("UPDATE recurring_booking_series SET status='paused' WHERE id::text=$1",[series.id]);await client.query("COMMIT");paused.push(series.id);continue;}const startsAt=locked.rows[0].next_occurrence_at;const endsAt=new Date(startsAt.getTime()+Number(source.duration_minutes)*60000);const basePrice=Number(source.base_price_cents)+Number(source.add_on_total_cents);const snapshot=calculateBookingFinancialSnapshot(basePrice,series.plan);const nextIndex=Number(source.recurrence_index??0)+1;
      const inserted=await client.query<{id:string}>(`INSERT INTO bookings(customer_id,provider_id,service_id,starts_at,ends_at,status,service_address,service_address_line1,service_address_line2,service_city,service_state,service_postal_code,access_instructions,notes,price_cents,booking_answers,provider_plan_snapshot,provider_fee_basis_points,platform_fee_cents,provider_payout_cents,customer_service_fee_cents,customer_total_cents,delivery_method,base_price_cents,add_on_total_cents,discount_cents,package_snapshot,add_on_snapshot,recurring_series_id,recurrence_index,booking_kind,pricing_type_snapshot,hourly_rate_cents_snapshot,billable_duration_minutes,billing_increment_minutes_snapshot,minimum_duration_minutes_snapshot,maximum_duration_minutes_snapshot) VALUES($1,$2,$3,$4,$5,'requested',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,0,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35) RETURNING id::text`,[series.customer_id,series.provider_id,series.service_id,startsAt,endsAt,source.service_address,source.service_address_line1,source.service_address_line2,source.service_city,source.service_state,source.service_postal_code,source.access_instructions,source.notes,basePrice,source.booking_answers,snapshot.providerPlan,snapshot.providerFeeBasisPoints,snapshot.providerFeeCents,snapshot.providerNetCents,snapshot.customerServiceFeeCents,snapshot.customerTotalCents,source.delivery_method,source.base_price_cents,source.add_on_total_cents,source.package_snapshot,source.add_on_snapshot,series.id,nextIndex,source.booking_kind,source.pricing_type_snapshot,source.hourly_rate_cents_snapshot,source.billable_duration_minutes,source.billing_increment_minutes_snapshot,source.minimum_duration_minutes_snapshot,source.maximum_duration_minutes_snapshot]);bookingId=inserted.rows[0].id;
      await client.query(`INSERT INTO booking_assignees(booking_id,team_member_id,is_owner) SELECT $2::uuid,team_member_id,is_owner FROM booking_assignees WHERE booking_id=$1`,[source.id,bookingId]);await client.query(`INSERT INTO booking_events(booking_id,event_type,message) VALUES($1,'recurring_occurrence_created','Next recurring occurrence created. Customer must pay this occurrence separately after provider confirmation.')`,[bookingId]);await client.query("UPDATE recurring_booking_series SET next_occurrence_at=$2 WHERE id::text=$1",[series.id,nextOccurrence(startsAt,locked.rows[0].frequency)]);await client.query(`INSERT INTO notifications(user_id,booking_id,type,title,message,href,dedupe_key) VALUES($1,$3,'recurring_booking','Upcoming recurring visit',$4,'/account/bookings/'||$3::uuid::text,'recurring-'||$3::uuid::text||'-customer'),($2,$3,'recurring_booking','Recurring request ready',$5,'/provider/dashboard/bookings/'||$3::uuid::text,'recurring-'||$3::uuid::text||'-provider') ON CONFLICT(dedupe_key) DO NOTHING`,[series.customer_id,series.provider_user_id,bookingId,`Your next ${series.service_title} visit is ready for provider confirmation. Payment is handled separately.`,`The next ${series.service_title} recurring visit is ready to review.`]);await client.query("COMMIT");created++;await sendBookingUpdateEmails(bookingId,"requested");
    }catch(error){await client.query("ROLLBACK");console.error("Recurring occurrence generation failed",series.id,error);paused.push(series.id);}finally{client.release();}}
  await database.query("INSERT INTO operations_checks(check_type,status,details) VALUES('recurring_booking_generation',$1,$2::jsonb)",[paused.length?"warning":"ok",JSON.stringify({created,paused})]);return{processed:due.rows.length,created,paused};
}
