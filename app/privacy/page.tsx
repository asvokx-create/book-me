import type { Metadata } from "next";
import { LegalPage } from "@/app/terms/page";

export const metadata: Metadata = { title: "Privacy Policy | BookMe" };

const sections = [
  ["1. Information we collect", <><p>BookMe collects information you provide, including your name, email, phone number, account credentials, provider profile, listing details, photos, booking details, messages, reviews, availability, safety reports, and support communications.</p><p className="mt-3">We also receive basic device, browser, log, cookie, session, and security information needed to operate and protect the service.</p></>],
  ["2. How we use information", "We use information to create and secure accounts, show listings, match customers with providers, manage bookings, deliver messages and notifications, prevent abuse, provide support, measure reliability, comply with law, and improve BookMe."],
  ["3. Booking and message visibility", "Booking participants can see the information needed to complete their booking. Messages are visible to the customer and provider in that service conversation. Do not place highly sensitive information, passwords, payment-card numbers, or government identifiers in messages or booking notes."],
  ["4. Automated moderation and AI help", <><p>Text submitted in messages, listings, reviews, cancellation reasons, and booking notes is checked by the BookMe Safety Bot for prohibited or high-risk language. Blocked attempts create a safety record containing the account, feature used, category, severity, time, and a one-way content fingerprint—not a reusable copy of the blocked text.</p><p className="mt-3">The Safety Bot uses BookMe-operated pattern and context rules and does not send this marketplace text to a third-party generative-AI provider for moderation.</p><p className="mt-3">If an eligible user chooses to use BookMe AI, their question and recent assistant conversation are sent to OpenAI to generate a response. Users should not submit passwords, authentication codes, payment-card details, or other sensitive information to the assistant.</p></>],
  ["5. Service providers and disclosures", "BookMe may share information with hosting, database, storage, authentication, security, communications, analytics, and payment providers only as needed to provide their services. We may also disclose information when required by law, to protect people or the platform, during a business transaction, or with your direction. BookMe does not sell personal information for money."],
  ["6. Retention", "We keep information while your account is active and as reasonably needed for bookings, safety, fraud prevention, dispute resolution, legal obligations, and platform integrity. Deleting a message or conversation from your view may not immediately remove safety, transaction, backup, or legal records."],
  ["7. Security", "BookMe uses reasonable administrative, technical, and organizational safeguards. No online service can promise perfect security, so use a unique password, enable two-factor authentication when available, and keep sensitive information out of chat."],
  ["8. Your choices", "You can review and update common account, listing, availability, and booking information in BookMe. You may request help with access, correction, or deletion through the support contact displayed in the app. Some records may be retained where legally permitted or required."],
  ["9. Children", "BookMe accounts and marketplace bookings are intended for adults age 18 or older. BookMe does not knowingly permit children to create accounts. Family-friendly content standards do not mean the service is directed to children."],
  ["10. Changes and contact", "We may update this policy as features and legal requirements change. Material changes will be communicated through BookMe or another appropriate method. Privacy questions may be sent through the BookMe support contact displayed in the app."],
] as const;

export default function PrivacyPage() {
  return <LegalPage eyebrow="Your information" title="Privacy Policy" intro="A plain-language explanation of what BookMe collects, why we use it, and how automated safety checks work." sections={sections} />;
}
