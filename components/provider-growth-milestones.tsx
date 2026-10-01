import { nextProviderGrowthMilestone, type ProviderGrowthMilestone } from "@/lib/affiliate-milestone-config";

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
  const completed = new Set(completedThresholds);
  const previousThreshold = [...milestones].reverse().find((item) => item.threshold <= activeProviderCount)?.threshold ?? 0;
  const nextIndex = next ? milestones.findIndex((item) => item.threshold === next.threshold) : milestones.length;
  const previousIndex = Math.max(0, nextIndex - 1);
  const firstThreshold = milestones[0]?.threshold ?? 0;
  const visualProgress = activeProviderCount < firstThreshold || milestones.length < 2 ? 0 : !next ? 100 : Math.max(0, Math.min(100, ((previousIndex + ((activeProviderCount - previousThreshold) / (next.threshold - previousThreshold))) / (milestones.length - 1)) * 100));
  const progressLabel = next
    ? `${activeProviderCount} of ${next.threshold} Active Providers toward the next milestone`
    : `${activeProviderCount} Active Providers; all current milestones completed`;

  return <section id="provider-growth-milestones" aria-labelledby="growth-milestones-heading" className="mt-5 rounded-2xl border border-[#183126]/10 bg-white px-4 py-4 sm:px-6 sm:py-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718078]">Provider growth</p><h2 id="growth-milestones-heading" className="mt-0.5 text-lg font-bold sm:text-xl">Milestone progress</h2></div>
      <span className="rounded-full bg-[#edf3e7] px-3 py-1.5 text-xs font-bold">{activeProviderCount} active {activeProviderCount === 1 ? "provider" : "providers"}</span>
    </div>
    {!enabled ? <div role="status" className="mt-4 rounded-xl bg-[#f5f5ef] px-4 py-3 text-sm leading-5"><strong>Growth bonuses are not included in this agreement.</strong> Standard commissions and campaign payments are unchanged.</div> : <>
      {historicalReviewPending ? <div role="status" className="mt-4 rounded-xl border border-[#b78e2e]/20 bg-[#fff8d8] px-4 py-3 text-sm leading-5"><strong>Historical progress is under review.</strong> Verified progress is shown; past bonuses remain pending administrator approval.</div> : null}
      <div className="mt-5">
        <div role="progressbar" aria-label={progressLabel} aria-valuemin={previousThreshold} aria-valuemax={next?.threshold ?? milestones.at(-1)?.threshold ?? 100} aria-valuenow={Math.min(activeProviderCount, next?.threshold ?? milestones.at(-1)?.threshold ?? activeProviderCount)} aria-valuetext={progressLabel} className="relative h-3">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-[#e8ece6]"><div className="h-full rounded-full bg-[#4c765e] transition-[width]" style={{ width: `${visualProgress}%` }} /></div>
          <div className="absolute inset-0 grid grid-cols-4">{milestones.map((milestone,index) => <span key={milestone.threshold} aria-hidden="true" className={`h-3 w-3 rounded-full border-2 border-white shadow-sm ${index===0?"justify-self-start":index===milestones.length-1?"justify-self-end":"justify-self-center"} ${completed.has(milestone.threshold)||activeProviderCount>=milestone.threshold?"bg-[#4c765e]":"bg-[#cfd7d1]"}`} />)}</div>
        </div>
        <div className="mt-2 grid grid-cols-4">{milestones.map((milestone,index) => <div key={milestone.threshold} className={`${index===0?"text-left":index===milestones.length-1?"text-right":"text-center"}`}><p className="text-[10px] font-bold leading-4 sm:text-xs">{milestone.threshold} providers</p><p className="text-[10px] font-bold leading-4 text-[#4c765e] sm:text-xs">+{money(milestone.bonusCents)} bonus</p></div>)}</div>
      </div>
      <p className="sr-only">An active provider completes 4 qualified paid bookings after refund, dispute, chargeback, and holding checks.</p>
    </>}
  </section>;
}
