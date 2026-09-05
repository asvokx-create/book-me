import Link from "next/link";
import AccountNav from "@/components/account-nav";
import MessagingCenter from "@/components/messaging-center";
import { getProviderById, getServiceById } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export default async function CustomerMessagesPage({ searchParams }: { searchParams: Promise<{ conversationId?: string; providerId?: string; serviceId?: string }> }) {
  const query = await searchParams;
  const provider = query.providerId ? await getProviderById(query.providerId) : null;
  const service = query.serviceId ? await getServiceById(query.serviceId) : null;
  const selectedService = service && service.providerId === provider?.id ? service : null;

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
      <header className="relative z-50 border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><AccountNav /></div></header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href="/account" className="text-sm font-bold text-[#62756a] transition hover:text-[#183126]">← My account</Link><h1 className="mt-3 text-4xl font-bold tracking-[-.045em]">Your messages</h1><p className="mt-2 text-[#6c7c74]">Talk directly with local providers before and after booking.</p></div><Link href="/services" className="self-start rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold transition hover:bg-[#e1d43d] sm:self-auto">Find a provider</Link></div>
        <MessagingCenter
          mode="customer"
          initialConversationId={query.conversationId}
          initialProviderId={provider?.id}
          initialProviderName={provider?.businessName}
          initialServiceId={selectedService?.id}
          initialServiceTitle={selectedService?.title}
        />
      </div>
    </main>
  );
}
