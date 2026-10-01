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
  const maximumThreshold = milestones.at(-1)?.threshold ?? 100;
  const visualProgress = Math.max(0, Math.min(100, (activeProviderCount / maximumThreshold) * 100));
  const progressLabel = next
    ? `${activeProviderCount} of ${next.threshold} Active Providers toward the next milestone`
    : `${activeProviderCount} Active Providers; all current milestones completed`;

  return <section id="provider-growth-milestones" aria-labelledby="growth-milestones-heading" className="mt-5 rounded-2xl border border-[#183126]/10 bg-white px-4 py-4 sm:px-6 sm:py-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718078]">Provider growth</p><h2 id="growth-milestones-heading" className="mt-0.5 text-lg font-bold sm:text-xl">Milestone progress</h2></div>
      <span className="rounded-full bg-[#edf3e7] px-3 py-1.5 text-xs font-bold">{activeProviderCount} active {activeProviderCount === 1 ? "provider" : "providers"}</span>
    </div>
    {!enabled ? <div role="status" className="mt-4 rounded-xl bg-[#f5f5ef] px-4 py-3 text-sm leading-5"><strong>Growth bonuses are not included in this agreement.</strong> Standard commissions and campaign payments are unchanged.</div> : <>
      <div className="mt-5">
        <div role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={maximumThreshold} aria-valuenow={Math.min(activeProviderCount, maximumThreshold)} aria-valuetext={progressLabel} className="relative h-3">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-[#e8ece6]"><div className="h-full rounded-full bg-[#4c765e] transition-[width]" style={{ width: `${visualProgress}%` }} /></div>
          {milestones.map((milestone,index) => <span key={milestone.threshold} aria-hidden="true" style={{ left: `${(milestone.threshold / maximumThreshold) * 100}%` }} className={`absolute top-0 h-3 w-3 rounded-full border-2 border-white shadow-sm ${index===milestones.length-1?"-translate-x-full":"-translate-x-1/2"} ${completed.has(milestone.threshold)||activeProviderCount>=milestone.threshold?"bg-[#4c765e]":"bg-[#cfd7d1]"}`} />)}
        </div>
        <div className="relative mt-2 h-10 sm:h-11">{milestones.map((milestone,index) => <div key={milestone.threshold} style={{ left: `${(milestone.threshold / maximumThreshold) * 100}%` }} className={`absolute top-0 w-12 text-center sm:w-20 ${index===milestones.length-1?"-translate-x-full text-right":"-translate-x-1/2"}`}><p className="text-[9px] font-bold leading-4 sm:text-xs">{milestone.threshold} providers</p><p className="text-[9px] font-bold leading-4 text-[#4c765e] sm:text-xs">+{money(milestone.bonusCents)} bonus</p></div>)}</div>
      </div>
      {historicalReviewPending ? <p role="status" className="mt-1 text-xs leading-5 text-[#718078]"><strong>Historical review pending.</strong> Past bonuses remain subject to administrator approval.</p> : null}
      <p className="sr-only">An active provider completes 4 qualified paid bookings after refund, dispute, chargeback, and holding checks.</p>
    </>}
  </section>;
}
