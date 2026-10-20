const PREFETCH_VALUES = ["prefetch", "prerender"];
const AUTOMATED_USER_AGENT = /(?:bot|crawler|spider|slurp|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|google-inspectiontool|headlesschrome)/i;

export function shouldRecordAffiliateLanding(input: {
  method: string;
  url: string;
  headers: Pick<Headers, "get">;
}) {
  if (input.method.toUpperCase() !== "GET") return false;

  const url = new URL(input.url);
  if (url.pathname !== "/providers/join" || !url.searchParams.get("ref")?.trim()) return false;

  const purpose = `${input.headers.get("purpose") ?? ""} ${input.headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (PREFETCH_VALUES.some((value) => purpose.includes(value))) return false;

  const destination = input.headers.get("sec-fetch-dest")?.toLowerCase();
  if (destination && destination !== "document") return false;

  const userAgent = input.headers.get("user-agent") ?? "";
  return !AUTOMATED_USER_AGENT.test(userAgent);
}
