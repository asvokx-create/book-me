import Link from "next/link";
import AdminRecommendationManager from "@/components/admin-recommendation-manager";

export default function AdminRecommendationsPage(){
  return <main className="min-h-screen bg-[#f8f7f3] px-4 py-8 text-[#183126]"><div className="dashboard-container"><Link href="/admin" className="text-sm font-bold underline underline-offset-4">← Admin console</Link><div className="mt-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Trust and reputation</p><h1 className="mt-2 text-3xl font-bold">Client Recommendations</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#687970]">Approve genuine outside-client feedback or hide/reject abuse. These items remain separate from verified booking reviews.</p></div><AdminRecommendationManager/></div></main>;
}
