import ProviderDashboard from "@/components/provider-dashboard";

export default async function ProviderMessagesPage({ searchParams }: { searchParams: Promise<{ conversationId?: string }> }) {
  const query = await searchParams;
  return <ProviderDashboard section="messages" initialConversationId={query.conversationId} />;
}
