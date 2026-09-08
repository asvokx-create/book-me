import type { ServiceListing } from "./marketplace";

const samples = [
  ["Fresh Start Deep Cleaning", "Home cleaning", "Fresh Start Home Care", 165, 180, "A detailed top-to-bottom home cleaning covering kitchens, bathrooms, bedrooms, floors, fixtures, and high-touch surfaces."],
  ["Weekly Home Cleaning", "Home cleaning", "Cedar & Sage Cleaning", 110, 120, "Recurring maintenance cleaning designed to keep busy households comfortable, tidy, and ready for the week ahead."],
  ["Complete Interior Car Detail", "Car detailing", "Cascade Auto Spa", 195, 180, "A complete interior reset with vacuuming, stain treatment, surface detailing, glass cleaning, and careful finishing throughout."],
  ["Premium Mobile Auto Detail", "Car detailing", "Rain City Mobile Detail", 275, 240, "Mobile interior and exterior detailing brought to your driveway with paint-safe washing and a polished final inspection."],
  ["Seasonal Yard Cleanup", "Lawn & garden", "Evergreen Outdoor Care", 225, 240, "Seasonal leaf, branch, bed, and lawn cleanup for a cleaner outdoor space and easier ongoing maintenance."],
  ["Lawn Mowing and Edging", "Lawn & garden", "Plateau Lawn Works", 65, 60, "Reliable mowing, trimming, edging, and cleanup for residential yards of typical neighborhood size."],
  ["Small Home Repairs", "Handyman", "Eastside Home Helpers", 145, 120, "Help with common household repairs, mounting, adjustments, hardware replacement, and a practical project checklist."],
  ["Furniture Assembly Visit", "Furniture assembly", "Built Right Assembly", 95, 90, "Careful assembly of boxed furniture with hardware organization, leveling, placement, and packaging cleanup."],
  ["Driveway Pressure Washing", "Pressure washing", "ClearPath Exterior Care", 180, 150, "Surface-appropriate pressure washing for residential driveways, walkways, patios, and other durable outdoor areas."],
  ["Interior Room Painting", "House painting", "Northwest Color Co.", 425, 480, "Professional preparation and interior painting for one standard room, including clean lines and a tidy work area."],
  ["Portrait Photography Session", "Photography", "Pine & Light Studio", 240, 90, "A relaxed outdoor portrait session with guided posing and a curated gallery of professionally edited images."],
  ["Small Business Brand Photos", "Photography", "Eastside Story Studio", 390, 180, "A planned brand photography session for teams, workspaces, products, and social-media-ready business imagery."],
  ["Local Moving Assistance", "Moving help", "Summit Moving Support", 260, 180, "Extra hands for loading, unloading, lifting, furniture placement, and organizing items during a local move."],
  ["Garage Junk Removal", "Junk removal", "Clear Space Hauling", 210, 120, "Removal of common household clutter and garage items with loading, sweep-up, and responsible disposal planning."],
  ["Dog Walking Visit", "Pet care", "Happy Trails Pet Care", 32, 45, "A neighborhood dog walk tailored to your pet's pace, routine, and care instructions, with an update after the visit."],
  ["In-Home Pet Sitting", "Pet care", "Companion Pet Services", 78, 120, "In-home feeding, play, medication reminders, litter or yard care, and a detailed visit update for pet owners."],
  ["Math Tutoring Session", "Tutoring", "Eastside Learning Lab", 70, 60, "One-on-one math support focused on current coursework, clear explanations, practice problems, and stronger study habits."],
  ["Home Wi-Fi and Device Setup", "Tech help", "SimpleTech Eastside", 125, 90, "Patient in-home help connecting devices, improving Wi-Fi setup, installing updates, and explaining everyday technology."],
  ["Kitchen Faucet Replacement", "Plumbing", "Neighborhood Plumbing Help", 185, 120, "Removal and replacement of a compatible kitchen faucet with connection checks and a clean final work area."],
  ["Light Fixture Installation", "Electrical", "Bright Home Services", 175, 120, "Replacement of a compatible residential light fixture with careful mounting, testing, and basic cleanup."],
] as const;

const cities = ["Issaquah", "Sammamish", "Bellevue", "Renton", "Redmond"] as const;

export function getStressTestServices(): ServiceListing[] {
  return samples.map(([title, category, provider, price, durationMinutes, description], index) => ({
    id: `stress-test-${index + 1}`,
    slug: `stress-test-${index + 1}`,
    title,
    category,
    description,
    price,
    durationMinutes,
    providerId: `stress-provider-${index + 1}`,
    provider,
    city: cities[index % cities.length],
    state: "WA",
    imageUrls: [`/service-samples/service-${String(index + 1).padStart(2, "0")}.webp`],
    emailVerified: index % 3 !== 0,
    phoneVerified: index % 4 !== 0,
    identityVerified: index % 5 !== 0,
    businessVerified: index % 2 === 0,
    profileScreened: index % 3 === 0,
    cancellationWindowHours: index % 2 === 0 ? 24 : 48,
    cancellationPolicy: "Appointments may be cancelled or rescheduled without a provider fee before the notice window. Late changes may require provider review because labor and travel time have already been reserved.",
    noShowPolicy: "If the customer is unavailable at the confirmed time, the provider will attempt contact through BubsBookings before documenting the visit and requesting support review.",
    serviceRadiusMiles: 250,
    bookingQuestions: [
      `What should the ${category.toLowerCase()} professional know before arriving?`,
      "Are there access instructions, parking details, pets, or other conditions to plan for?",
    ],
    distanceMiles: index * 0.7 + 0.4,
  }));
}

export function getStressTestServiceBySlug(slug: string) {
  return getStressTestServices().find((service) => service.slug === slug) ?? null;
}
