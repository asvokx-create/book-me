import { milestoneProgressPercent, nextProviderGrowthMilestone, type ProviderGrowthMilestone } from "@/lib/affiliate-milestone-config";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

export default function ProviderGrowthMilestones({
  activeProviderCount,
  milestones,
  completedThresholds,
  enabled,
  historicalReviewPending = false,
}: {
  activeProviderCount: number;
  milestones: ProviderGrowthMilestone[];
  completedThresholds: number[];
  enabled: boolean;
  historicalReviewPending?: boolean;
}) {
  const next = nextProviderGrowthMilestone(activeProviderCount, milestones);
  const progress = milestoneProgressPercent(activeProviderCount, milestones);
  const completed = new Set(completedThresholds);
  const previousThreshold = [...milestones].reverse().find((item) => item.threshold <= activeProviderCount)?.threshold ?? 0;
  const progressLabel = next
    ? `${activeProviderCount} of ${next.threshold} Active Providers toward the next milestone`
    : `${activeProviderCount} Active Providers; all current milestones completed`;

  return <section id="provider-growth-milestones" aria-labelledby="growth-milestones-heading" className="mt-7 rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Quality provider growth</p><h2 id="growth-milestones-heading" className="mt-1 text-2xl font-bold">Provider Growth Milestones</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#61736a]">An Active Provider counts after completing 4 qualified paid bookings that clear the normal refund, dispute, chargeback, and holding requirements.</p></div><span className="rounded-full bg-[#edf3e7] px-4 py-2 text-sm font-bold">{activeProviderCount} Active {activeProviderCount === 1 ? "Provider" : "Providers"}</span></div>
    {!enabled ? <div role="status" className="mt-5 rounded-2xl border border-[#183126]/10 bg-[#f5f5ef] p-4 text-sm leading-6"><strong>Milestone bonuses are not included in this partner agreement.</strong> Your standard activation bonus, revenue share, and any custom campaign payments remain separate.</div> : <>
      {historicalReviewPending ? <div role="status" className="mt-5 rounded-2xl border border-[#b78e2e]/25 bg-[#fff8d8] p-4 text-sm leading-6"><strong>Historical progress is under administrative review.</strong> Your verified Active Provider count is shown, but past milestone bonuses will not be created until BubsBookings reviews the historical liability.</div> : null}
      <div className="mt-6"><div className="flex items-end justify-between gap-3 text-sm"><strong>{next ? `Next: ${next.threshold} Active Providers` : "All current milestones completed"}</strong>{next ? <span>{next.threshold - activeProviderCount} remaining · {money(next.bonusCents)} bonus</span> : <span>Thank you for growing the marketplace.</span>}</div><div role="progressbar" aria-label={progressLabel} aria-valuemin={previousThreshold} aria-valuemax={next?.threshold ?? milestones.at(-1)?.threshold ?? 100} aria-valuenow={Math.min(activeProviderCount, next?.threshold ?? milestones.at(-1)?.threshold ?? activeProviderCount)} aria-valuetext={progressLabel} className="mt-3 h-4 overflow-hidden rounded-full border border-[#183126]/10 bg-[#e8ece6]"><div className="h-full rounded-full bg-[#4c765e] transition-[width]" style={{ width: `${progress}%` }} /></div></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{milestones.map((milestone) => { const recorded = completed.has(milestone.threshold); const reached = activeProviderCount >= milestone.threshold; const state = recorded ? "Completed" : reached && historicalReviewPending ? "Review pending" : next?.threshold === milestone.threshold ? `${milestone.threshold - activeProviderCount} remaining` : "Locked"; return <article key={milestone.threshold} className={`rounded-2xl border p-4 ${recorded ? "border-[#4d765e]/30 bg-[#edf5e9]" : next?.threshold === milestone.threshold ? "border-[#c8b93e]/40 bg-[#fffbe1]" : "border-[#183126]/10 bg-[#f7f7f3]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-2xl font-bold">{milestone.threshold}</p><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">Active Providers</p></div><span aria-hidden="true" className="text-xl">{recorded ? "✓" : next?.threshold === milestone.threshold ? "→" : "○"}</span></div><p className="mt-4 font-bold">{milestone.threshold === milestones[0]?.threshold ? money(milestone.bonusCents) : `+${money(milestone.bonusCents)}`} bonus</p><p className="mt-1 text-xs font-bold text-[#61736a]">{state}</p></article>; })}</div>
    </>}
  </section>;
}
