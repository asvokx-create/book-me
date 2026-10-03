import ExplainedUi from "@/components/explained-ui";
import { campaignDurationLabel, partnerCompensationHeading, type PartnerCompensationType } from "@/lib/partner-compensation";

type Props = {
  compensationType: PartnerCompensationType;
  activationBonusEnabled: boolean;
  activationBonusCents: number;
  revenueShareEnabled: boolean;
  revenueShareBasisPoints: number;
  revenueShareDurationMonths: number;
  milestoneBonusesEnabled: boolean;
  customCampaignEnabled: boolean;
  customCampaignAmountCents: number | null;
  customCampaignStartsOn: Date | null;
  customCampaignEndsOn: Date | null;
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function PartnerCompensationSummary(props: Props) {
  const campaignDuration = campaignDurationLabel(props.customCampaignStartsOn, props.customCampaignEndsOn);
  return <section id="partner-terms" className="partner-compensation-summary mt-7 scroll-mt-5 rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 sm:p-6" aria-labelledby="partnership-heading">
    <p className="text-xs font-bold uppercase tracking-[.14em] text-[#687970]">Your compensation</p>
    <h2 id="partnership-heading" className="mt-1 text-xl font-bold">{partnerCompensationHeading(props.compensationType)}</h2>
    <p className="mt-2 text-sm leading-6 text-[#687970]">These are the compensation settings currently assigned to your Partner account. Disabled rewards are not included.</p>
    <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {props.activationBonusEnabled ? <div className="partner-term-item rounded-2xl bg-[#f3f6ef] p-4"><dt className="text-xs font-bold uppercase tracking-wider text-[#687970]">Activation bonus</dt><dd className="mt-2 text-xl font-bold">{money(props.activationBonusCents)}</dd><p className="mt-1 text-xs leading-5 text-[#687970]">Per qualified referred provider</p></div> : null}
      {props.revenueShareEnabled ? <div className="partner-term-item rounded-2xl bg-[#f3f6ef] p-4"><dt className="text-xs font-bold uppercase tracking-wider text-[#687970]">Revenue share</dt><dd className="mt-2 text-xl font-bold">{props.revenueShareBasisPoints / 100}%</dd><ExplainedUi id="dashboard-revenue-share-help" explanation={`This is a share of eligible BubsBookings provider marketplace-fee revenue—not the provider's service price.`}><p className="mt-1 text-xs leading-5 text-[#687970]">{props.revenueShareDurationMonths} month earning period</p></ExplainedUi></div> : null}
      {props.milestoneBonusesEnabled ? <div className="partner-term-item rounded-2xl bg-[#f3f6ef] p-4"><dt className="text-xs font-bold uppercase tracking-wider text-[#687970]">Provider Growth Milestones</dt><dd className="mt-2 text-xl font-bold">Enabled</dd><p className="mt-1 text-xs leading-5 text-[#687970]">Eligible milestone progress appears below</p></div> : null}
      {props.customCampaignEnabled && props.customCampaignAmountCents !== null ? <div className="partner-term-item rounded-2xl bg-[#fff9d4] p-4"><dt className="text-xs font-bold uppercase tracking-wider text-[#687970]">Fixed campaign payment</dt><dd className="mt-2 text-xl font-bold">{money(props.customCampaignAmountCents)}</dd><p className="mt-1 text-xs leading-5 text-[#687970]">{campaignDuration ?? "Campaign dates pending"}{props.customCampaignStartsOn && props.customCampaignEndsOn ? ` · ${props.customCampaignStartsOn.toLocaleDateString()}–${props.customCampaignEndsOn.toLocaleDateString()}` : ""}</p></div> : null}
    </dl>
  </section>;
}
