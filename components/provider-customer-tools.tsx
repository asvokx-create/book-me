"use client";

import Link from "next/link";
import { useEffect,useState } from "react";
import ProfileAvatar from "@/components/profile-avatar";

type Customer={customerId:string;displayName:string;image:string;completedBookings:number;totalBookingValue:number;lastBookingAt:string;serviceId:string;serviceTitle:string;serviceSlug:string;lastOfferAt:string|null;offerAllowed:boolean};

export default function ProviderCustomerTools(){
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [selected,setSelected]=useState<Customer|null>(null);
  const [message,setMessage]=useState("");
  const [working,setWorking]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/providers/customers",{signal:controller.signal,cache:"no-store"})
      .then(async response=>response.ok?response.json() as Promise<{allowed:boolean;customers:Customer[]}>:null)
      .then(data=>{if(data){setAllowed(data.allowed);setCustomers(data.customers);}})
      .catch(()=>null);
    return()=>controller.abort();
  },[]);
  function begin(customer:Customer){
    setSelected(customer);
    setMessage(`Hi ${customer.displayName.split(" ")[0]}, thanks again for booking ${customer.serviceTitle}. If you need it again, I’d be happy to help. You can review current pricing and availability here: /services/${customer.serviceSlug}`);
    setError("");setNotice("");
  }
  async function send(){
    if(!selected)return;setWorking(true);setError("");
    const response=await fetch("/api/providers/customers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerId:selected.customerId,serviceId:selected.serviceId,message})}).catch(()=>null);
    const data=response?await response.json() as {error?:string}:null;setWorking(false);
    if(!response?.ok){setError(data?.error??"We could not send this offer.");return;}
    setNotice("Repeat-booking message sent.");setSelected(null);
    setCustomers(current=>current.map(item=>item.customerId===selected.customerId?{...item,lastOfferAt:new Date().toISOString(),offerAllowed:false}:item));
  }
  if(allowed===null)return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-sm text-[#718078]">Loading customer history…</p></section>;
  if(!allowed)return <section className="rounded-[2rem] border border-[#d6ca65] bg-[#fff8cd] p-7"><h1 className="text-2xl font-bold">Past customers</h1><p className="mt-2 text-sm leading-6 text-[#6f6840]">Repeat-customer history and carefully limited follow-up offers are included with Pro.</p><Link href="/provider/dashboard/billing" className="mt-5 inline-flex rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">View Pro</Link></section>;
  return <>
    <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Repeat business</p><h1 className="mt-2 text-3xl font-bold">Past customers</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687970]">Only customers who completed a booking with your business appear here. Private contact details are not exposed. Follow-ups stay inside BubsBookings and are limited to one per customer every 30 days.</p>
      {notice&&<p role="status" className="mt-4 rounded-xl bg-[#e6f1e5] p-3 text-sm font-bold text-[#34704a]">{notice}</p>}
      <div className="mt-6 grid gap-3">{customers.length?customers.map(customer=>{
        return <article key={customer.customerId} className="grid gap-4 rounded-2xl border border-[#183126]/10 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><ProfileAvatar name={customer.displayName} imageUrl={customer.image} className="h-11 w-11 shrink-0 text-xs"/><div className="min-w-0"><p className="truncate font-bold">{customer.displayName}</p><p className="mt-1 text-sm text-[#687970]">{customer.completedBookings} completed · ${customer.totalBookingValue.toFixed(2)} booking history</p><p className="mt-1 text-xs text-[#7a8881]">Last: {customer.serviceTitle} · {new Date(customer.lastBookingAt).toLocaleDateString()}</p></div></div><div className="flex flex-wrap gap-2"><Link href={`/services/${customer.serviceSlug}`} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold">View current listing</Link><button type="button" disabled={!customer.offerAllowed} onClick={()=>begin(customer)} className="rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50">{customer.offerAllowed?"Send booking offer":"Offer sent recently"}</button></div></article>;
      }):<div className="rounded-2xl bg-[#f7f7f2] p-6 text-sm text-[#687970]">Past customers appear after their first completed booking.</div>}</div>
    </section>
    {selected&&<div className="fixed inset-0 z-[90] grid place-items-center bg-[#10251c]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="repeat-offer-title"><div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><h2 id="repeat-offer-title" className="text-2xl font-bold">Invite {selected.displayName} to book again</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Keep it relevant to their prior booking. Current listing pricing and availability apply.</p><label className="mt-5 block text-sm font-bold">Message<textarea value={message} onChange={event=>setMessage(event.target.value)} minLength={10} maxLength={1000} rows={6} className="mt-2 w-full resize-y rounded-2xl border border-[#183126]/15 p-4 text-sm outline-none focus:border-[#4d725d]"/></label>{error&&<p role="alert" className="mt-3 text-sm font-bold text-[#9a4e25]">{error}</p>}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={()=>setSelected(null)} className="min-h-11 rounded-full border border-[#183126]/15 px-5 text-sm font-bold">Cancel</button><button type="button" disabled={working||message.trim().length<10} onClick={()=>void send()} className="min-h-11 rounded-full bg-[#183126] px-5 text-sm font-bold text-white disabled:opacity-50">{working?"Sending…":"Send secure message"}</button></div></div></div>}
  </>;
}
