export type Guide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  readMinutes: number;
  publishedAt: string;
  updatedAt: string;
  sections: Array<{ heading: string; paragraphs: string[]; checklist?: string[] }>;
};

export const GUIDES: Guide[] = [
  {
    slug: "how-to-choose-a-local-service-provider",
    title: "How to choose a local service provider",
    description: "A practical checklist for comparing local professionals, asking useful questions, and booking with fewer surprises.",
    category: "Hiring local help",
    readMinutes: 6,
    publishedAt: "2026-09-06",
    updatedAt: "2026-09-06",
    sections: [
      { heading: "Start with a clearly defined job", paragraphs: ["Write down the result you want before comparing providers. Include the approximate size of the job, preferred timing, location, and anything that could change the work involved. A clear request helps providers give realistic availability and pricing."], checklist: ["The result you expect", "Your preferred date and backup dates", "Relevant measurements, photos, or access details", "Anything unusual that could affect time or materials"] },
      { heading: "Compare more than the starting price", paragraphs: ["A starting price is useful for narrowing choices, but it may not be the final quote. Compare what is included, estimated duration, travel area, cancellation terms, and whether materials are part of the price. If a provider sends a revised quote, review it before confirming the booking."], checklist: ["Scope of work", "Materials and equipment", "Estimated duration", "Cancellation and no-show policies"] },
      { heading: "Look for useful trust signals", paragraphs: ["Read reviews from completed bookings and check the provider’s profile details. Verification badges describe specific checks; they are not a guarantee of quality or safety. For regulated work, ask the provider directly about any license, insurance, or permit that may apply."], checklist: ["Completed-booking reviews", "A complete service description", "Recent and relevant photos", "Licensing or insurance where the job requires it"] },
      { heading: "Keep the conversation on the platform", paragraphs: ["Use the service-specific BubsBookings conversation so the request, quote, and important decisions remain together. Never send passwords, full card numbers, bank credentials, or government identification through chat."], checklist: ["Confirm the date, time, address, and scope", "Record approved changes in the booking conversation", "Pay through the supported checkout flow", "Report threatening, deceptive, or unsafe behavior"] },
    ],
  },
  {
    slug: "car-detailing-cost-and-booking-checklist",
    title: "Car detailing: what affects the price?",
    description: "Understand the details that can change a car-detailing quote and what to share before requesting an appointment.",
    category: "Car detailing",
    readMinutes: 5,
    publishedAt: "2026-09-06",
    updatedAt: "2026-09-06",
    sections: [
      { heading: "Why prices vary", paragraphs: ["Vehicle size, interior condition, pet hair, stains, odors, paint condition, and requested treatments can all change the amount of time and material required. That is why many listings use a starting price and confirm the final scope before accepting the booking."], checklist: ["Vehicle year, make, and model", "Interior, exterior, or both", "Pet hair, spills, stains, or strong odors", "Any paint correction or protective treatment requested"] },
      { heading: "Share accurate photos", paragraphs: ["A few well-lit photos can help a detailer estimate the job. Include the front and rear seating areas, cargo area, exterior panels, and close-ups of problem spots. Photos should show the actual condition without filters."], checklist: ["Wide interior views", "Exterior from multiple sides", "Close-ups of stains or damage", "Cargo or trunk area when included"] },
      { heading: "Confirm what is included", paragraphs: ["Ask whether the service includes vacuuming, shampoo or extraction, leather treatment, wheel cleaning, wax, paint decontamination, or other add-ons. Also confirm whether the provider needs access to power or water and whether the service can be performed at your location."] },
      { heading: "Before the appointment", paragraphs: ["Remove valuables and personal documents, provide safe access to the vehicle, and communicate any alarm or parking instructions. Do not leave keys in an unsecured location unless you have agreed on a safe handoff with the provider."], checklist: ["Remove valuables and child seats if needed", "Confirm access to water or power", "Agree on the key handoff", "Review the final quote before confirming"] },
    ],
  },
  {
    slug: "questions-to-ask-before-hiring-a-handyman",
    title: "Questions to ask before hiring a handyman",
    description: "Use these questions to clarify the job, materials, timing, and qualifications before work begins.",
    category: "Handyman",
    readMinutes: 5,
    publishedAt: "2026-09-06",
    updatedAt: "2026-09-06",
    sections: [
      { heading: "Describe the whole project", paragraphs: ["Small details can change the tools, materials, and time a job requires. Share photos, dimensions, the type of wall or surface, and whether old hardware must be removed. If there are several tasks, list each one instead of describing the visit as general repairs."] },
      { heading: "Ask about experience and requirements", paragraphs: ["Ask whether the provider has completed similar work and whether the project requires a specialist, permit, or licensed trade. Electrical, plumbing, structural, roofing, and other regulated work may require credentials that vary by location. Do not rely on a general profile badge as proof of a trade license."], checklist: ["Have you completed this type of project?", "Does this work require a license or permit?", "Do you carry insurance appropriate for the work?", "Who will actually perform the service?"] },
      { heading: "Clarify labor and materials", paragraphs: ["Confirm whether the quote includes materials, pickup time, disposal, travel, and cleanup. If you are buying parts yourself, ask for exact sizes or specifications. Agree on how unexpected conditions or additional work will be quoted before the provider proceeds."] },
      { heading: "Finish with a written summary", paragraphs: ["Keep the agreed scope, appointment details, quote, and any approved changes in the booking conversation. After the work is complete, inspect the result and raise any concern promptly through the booking or dispute process."], checklist: ["Final scope and price", "Arrival window and expected duration", "Who supplies materials", "Cleanup and disposal expectations"] },
    ],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
