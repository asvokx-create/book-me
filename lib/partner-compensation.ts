export type PartnerCompensationType = "standard" | "custom";

export function partnerCompensationHeading(type: PartnerCompensationType) {
  return type === "custom" ? "Custom Partnership" : "Standard Partner Program";
}

export function campaignDurationLabel(startsOn: Date | string | null, endsOn: Date | string | null) {
  if (!startsOn || !endsOn) return null;
  const start = new Date(startsOn);
  const end = new Date(endsOn);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  if (days < 45) return "1 month";
  const months = Math.max(1, Math.round(days / 30.4375));
  return `${months} months`;
}
