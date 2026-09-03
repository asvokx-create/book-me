import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/app/terms/page";

export const metadata: Metadata = { title: "AI & Safety Transparency | BookMe" };

const sections = [
  ["What the Safety Bot checks", "The BookMe Safety Bot checks newly submitted chat messages, service titles and descriptions, booking notes, cancellation reasons, and reviews. It looks for profanity, harassment, hate, explicit sexual content, exploitation, credible threats, and language associated with serious illegal activity."],
  ["What happens when content is detected", "Content that matches a safety rule is not posted. The user receives a clear request to revise it. BookMe records a limited event containing the account, feature, safety category, severity, time, and a one-way fingerprint so repeated abuse can be investigated without storing a separate copy of the blocked text."],
  ["Technology and attribution", <><p>The current Safety Bot is a BookMe-operated automated rules system. It does not generate messages, make booking decisions, determine prices, or rank providers. It does not currently send private chat or booking text to OpenAI or another third-party generative-AI provider. If BookMe later uses an outside AI provider, this page and the Privacy Policy will identify that use before it is enabled.</p><p className="mt-3">BookMe’s transparency and risk-documentation approach is informed by the voluntary <Link href="https://www.nist.gov/itl/ai-risk-management-framework" target="_blank" rel="noreferrer" className="font-bold underline">NIST AI Risk Management Framework</Link>.</p></>],
  ["Limits", "Automated moderation can miss harmful language or block harmless language, especially slang and context-dependent phrases. A passed check is not an endorsement, safety guarantee, background check, or substitute for human judgment."],
  ["Safety and emergencies", "Do not rely on BookMe for emergencies. If someone may be in immediate danger, contact local emergency services. Use account security controls if you suspect unauthorized access, and stop communicating with users who pressure you to leave the platform or share sensitive information."],
  ["Fairness and accountability", "BookMe applies the same text rules to customers and providers. Safety checks do not use protected characteristics to approve bookings or rank people. BookMe will document material changes to the system and provide a support path for users who believe content was blocked incorrectly."],
] as const;

export default function AiTransparencyPage() {
  return <LegalPage eyebrow="Trust and safety" title="Automation & AI transparency" intro="What BookMe’s Safety Bot does, what data it uses, and where automated judgment stops." sections={sections} />;
}
