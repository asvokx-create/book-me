export type Guide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  readMinutes: number;
  publishedAt: string;
  updatedAt: string;
  ctaHref?: string;
  ctaLabel?: string;
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
  {
    slug: "house-cleaning-cost-near-issaquah",
    title: "What affects house-cleaning prices near Issaquah?",
    description: "Learn which home details shape a cleaning quote and how to compare services without overlooking important differences.",
    category: "Home cleaning",
    readMinutes: 6,
    publishedAt: "2026-09-09",
    updatedAt: "2026-09-09",
    ctaHref: "/services?category=Home+cleaning&location=Issaquah%2C+WA&radius=25#service-listings",
    ctaLabel: "Compare home cleaners",
    sections: [
      { heading: "The size of the home is only the starting point", paragraphs: ["Square footage and the number of bedrooms and bathrooms help a cleaner estimate the visit, but condition and scope matter just as much. A smaller home needing a deep clean can take longer than a larger home receiving regular maintenance."], checklist: ["Approximate square footage", "Number of bedrooms and bathrooms", "Standard, deep, move-in, or move-out cleaning", "How recently the home was professionally cleaned"] },
      { heading: "Be specific about priority areas", paragraphs: ["Inside appliances, interior windows, baseboards, cabinets, pet hair, and heavy buildup may be priced separately or require more time. List your priorities before requesting a booking so providers can compare the same scope instead of making different assumptions."], checklist: ["Kitchen appliances and cabinets", "Showers, grout, and hard-water buildup", "Interior windows or blinds", "Pet hair or allergy-related requests"] },
      { heading: "Ask what the service includes", paragraphs: ["Confirm whether the cleaner supplies products and equipment, changes linens, takes out trash, or handles dishes. If you prefer fragrance-free or specialty products, mention that early and ask whether you should provide them."] },
      { heading: "Compare the complete offer", paragraphs: ["A useful quote should make the expected work, estimated time, access needs, and cancellation terms clear. Review those details alongside the price, and use the booking conversation to record anything you add or remove."], checklist: ["Included rooms and tasks", "Supplies and equipment", "Estimated duration and arrival window", "How extra work will be approved"] },
    ],
  },
  {
    slug: "mobile-car-detailing-vs-detail-shop",
    title: "Mobile car detailing vs. a detail shop",
    description: "Compare convenience, workspace needs, services, and timing before deciding where to have your vehicle detailed.",
    category: "Car detailing",
    readMinutes: 5,
    publishedAt: "2026-09-09",
    updatedAt: "2026-09-09",
    ctaHref: "/services?category=Car+detailing&location=Issaquah%2C+WA&radius=25#service-listings",
    ctaLabel: "Explore car detailing",
    sections: [
      { heading: "When mobile detailing is a good fit", paragraphs: ["A mobile detailer comes to an agreed location, which can save travel and waiting time. It works best when there is enough safe space around the vehicle and the property permits the work."], checklist: ["A legal and safe place to work", "Permission from the property owner or manager", "Access to water or power if the provider requires it", "A backup plan for severe weather"] },
      { heading: "When a shop may be better", paragraphs: ["A dedicated shop offers a controlled workspace and may be better suited to paint correction, coatings, odor treatment, or work that needs specialized lighting and equipment. You will need to plan for drop-off, pickup, and possibly leaving the vehicle for longer."] },
      { heading: "Compare the actual package", paragraphs: ["Do not assume two services with similar names include the same work. Ask about seats, carpets, cargo areas, wheels, wax, decontamination, stain treatment, and any condition-based charge."], checklist: ["Interior, exterior, or both", "Products and treatments included", "Vehicle-size adjustments", "Estimated time and weather policy"] },
      { heading: "Choose based on the job, not only convenience", paragraphs: ["For routine cleaning, mobile service may be the simplest choice. For restoration-style work, a shop environment may offer advantages. Share clear photos and ask the provider which setting is appropriate for your vehicle and requested result."] },
    ],
  },
  {
    slug: "lawn-care-pricing-seasonal-checklist",
    title: "Lawn-care pricing and seasonal planning",
    description: "Understand what changes a lawn-care quote and prepare a practical plan for recurring or one-time yard work.",
    category: "Lawn & garden",
    readMinutes: 6,
    publishedAt: "2026-09-09",
    updatedAt: "2026-09-09",
    ctaHref: "/services?category=Lawn+%26+garden&location=Issaquah%2C+WA&radius=25#service-listings",
    ctaLabel: "Browse lawn and garden services",
    sections: [
      { heading: "What usually changes the quote", paragraphs: ["Lot size, grass height, slope, obstacles, edging, cleanup, and disposal all affect the time and equipment a lawn job requires. Photos help, but measurements and an honest description of overgrowth make estimates more useful."], checklist: ["Approximate lawn or lot size", "Current grass and weed height", "Slopes, gates, play equipment, or tight access", "Whether clippings and debris must be removed"] },
      { heading: "One-time cleanup or recurring care", paragraphs: ["A first visit may involve extra trimming and cleanup before the yard is ready for regular maintenance. Ask the provider to separate the initial work from the recurring scope so you understand what later visits include."] },
      { heading: "Plan around the season", paragraphs: ["Growing conditions and weather change throughout the year. Spring may call for cleanup and frequent mowing, while dry periods can reduce mowing needs. Fall work may focus on leaves and preparing beds. Discuss the plan with the provider instead of assuming the same visit schedule will fit every month."], checklist: ["Spring cleanup and bed preparation", "Mowing and edging during active growth", "Watering restrictions or dry-season needs", "Fall leaves and winter preparation"] },
      { heading: "Confirm boundaries and expectations", paragraphs: ["Point out property lines, irrigation heads, delicate plants, pets, and areas that should not be treated. If fertilizer, herbicide, or another product may be used, ask what it is and follow the provider's safety instructions."] },
    ],
  },
  {
    slug: "prepare-your-home-for-a-service-appointment",
    title: "How to prepare your home for a service appointment",
    description: "A simple preparation checklist that helps providers start on time and protects your home, pets, and private information.",
    category: "Booking tips",
    readMinutes: 5,
    publishedAt: "2026-09-09",
    updatedAt: "2026-09-09",
    ctaHref: "/services",
    ctaLabel: "Find local help",
    sections: [
      { heading: "Confirm the plan before arrival", paragraphs: ["Review the date, arrival window, address, scope, price, and expected duration in the booking conversation. Share parking, gate, elevator, or building-entry instructions that the provider needs, but never send alarm codes, passwords, or payment credentials in chat."], checklist: ["Correct address and contact method", "Arrival and parking instructions", "Agreed scope and quote", "Any building or neighborhood restrictions"] },
      { heading: "Clear the work area", paragraphs: ["Move fragile items, personal documents, medication, cash, and valuables away from the workspace. Provide enough room for tools and equipment. If furniture or another heavy object must be moved, ask beforehand whether that is included rather than attempting an unsafe move yourself."] },
      { heading: "Plan for children and pets", paragraphs: ["Keep children and pets away from tools, open doors, cleaning products, ladders, and active work areas. Tell the provider about pets even if they will be in another room, and agree on how gates and doors should be handled."] },
      { heading: "Be available at the beginning and end", paragraphs: ["A brief walkthrough helps confirm priorities and existing conditions. Before the provider leaves, review the finished work when practical and discuss questions promptly. Record approved changes or unresolved concerns in the booking conversation."] },
    ],
  },
  {
    slug: "red-flags-when-hiring-a-local-provider",
    title: "Red flags when hiring a local service provider",
    description: "Recognize pressure tactics, unclear pricing, unsafe requests, and other warning signs before you confirm a booking.",
    category: "Hiring local help",
    readMinutes: 6,
    publishedAt: "2026-09-09",
    updatedAt: "2026-09-09",
    ctaHref: "/services",
    ctaLabel: "Compare local providers",
    sections: [
      { heading: "Pressure to leave the platform", paragraphs: ["Be cautious if someone immediately pushes you to move the conversation or payment elsewhere. Keeping the request, quote, and decisions together makes the booking easier to review. Never share card numbers, banking credentials, passwords, or verification codes in messages."] },
      { heading: "A quote that stays vague", paragraphs: ["A provider may need photos or a visit before giving a final price, but they should still explain how the price will be determined. Watch for unexplained fees, large changes without a revised scope, or requests to approve work you do not understand."], checklist: ["The tasks included", "Who supplies materials", "Potential add-on charges", "How changes will be approved"] },
      { heading: "Claims that cannot be clarified", paragraphs: ["For work that may require licensing, permits, or insurance, ask direct questions and verify through the appropriate local authority when needed. A marketplace profile or identity check does not replace a trade license or guarantee workmanship."] },
      { heading: "Unsafe or inappropriate behavior", paragraphs: ["Do not continue a meeting or appointment if you feel threatened or unsafe. Move to a safe place, contact emergency services when appropriate, and report the behavior to BubsBookings. Trust signals are useful context, but your safety comes first."], checklist: ["Unexpected people arrive without explanation", "The provider ignores agreed boundaries", "You are pressured to reveal private information", "The requested work appears unsafe or unlawful"] },
    ],
  },
  {
    slug: "questions-before-accepting-a-service-quote",
    title: "Questions to ask before accepting a service quote",
    description: "Use these questions to confirm scope, timing, materials, and possible extra charges before committing to the job.",
    category: "Booking tips",
    readMinutes: 5,
    publishedAt: "2026-09-09",
    updatedAt: "2026-09-09",
    ctaHref: "/services",
    ctaLabel: "Start comparing services",
    sections: [
      { heading: "What exactly is included?", paragraphs: ["Ask the provider to describe the finished result and the individual tasks covered by the quote. Clarify exclusions too. Two quotes can look similar while covering very different amounts of work."], checklist: ["Specific tasks and deliverables", "Preparation and cleanup", "Disposal or haul-away", "Anything specifically excluded"] },
      { heading: "Are materials and travel included?", paragraphs: ["Confirm who purchases materials, whether pickup time is included, and how substitutions will be handled. Ask about travel or service-area charges when the listing covers a wide region."] },
      { heading: "What could change the final price?", paragraphs: ["Some conditions cannot be confirmed until work begins. Ask the provider to identify likely unknowns and agree that additional work requires your approval. A revised quote should describe both the price change and the added scope."], checklist: ["Condition-based charges", "Hourly work beyond the estimate", "Material price changes", "Approval before extra work begins"] },
      { heading: "What happens if plans change?", paragraphs: ["Review the cancellation and no-show terms, the expected duration, and how delays will be communicated. Keep the accepted quote and later changes in the booking conversation so both sides can refer to the same information."] },
    ],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug);
}
