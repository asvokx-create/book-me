import BrandLockup from "@/components/brand-lockup";
import RecommendationForm from "@/components/recommendation-form";

export const metadata={title:"Client recommendation",robots:{index:false,follow:false}};

export default async function RecommendationPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  return <main className="min-h-screen bg-[#f8f7f3] px-4 py-10 text-[#183126]"><div className="mx-auto max-w-2xl"><BrandLockup/><section className="mt-8 rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_16px_45px_rgba(24,49,38,.08)] sm:p-9"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Outside-client feedback</p><h1 className="mt-2 text-3xl font-bold">Share a client recommendation</h1><p className="mt-3 text-sm leading-6 text-[#62736a]">Describe your real experience in your own words. If approved, it appears as a <strong>Client Recommendation</strong>—never as a verified BubsBookings review. Do not include private or sensitive information.</p><RecommendationForm token={token}/></section></div></main>;
}
