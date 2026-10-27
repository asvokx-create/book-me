import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AccountNav from "@/components/account-nav";
import BrandLockup from "@/components/brand-lockup";
import FavoriteButton from "@/components/favorite-button";
import HomeHeroPreview from "@/components/home-hero-preview";
import HomeServiceSearch from "@/components/home-service-search";
import MobileSiteNav from "@/components/mobile-site-nav";
import ServiceCategoryIcon from "@/components/service-category-icon";
import UiIcon from "@/components/ui-icon";
import { formatDuration, getServices, getServiceVisual, type ServiceListing } from "@/lib/marketplace";
import { getContextualLocation } from "@/lib/request-location";
import { publicPageMetadata } from "@/lib/seo";
import { formatServicePrice } from "@/lib/service-pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  title: "Find and book local or remote services",
  description: "Compare in-person and remote service listings, message providers, and request bookings across the United States.",
  pathname: "/",
});

const HOME_CATEGORIES = [
  "Home repair",
  "Photography",
  "Tutoring",
  "Event services",
  "Pet care",
  "Consulting",
  "Tech help",
  "Home cleaning",
  "Handyman",
] as const;

const TRUST_POINTS = [
  { icon: "services" as const, title: "Clear provider details", copy: "Compare service information before you decide." },
  { icon: "messages" as const, title: "Direct messaging", copy: "Ask questions or discuss a custom quote." },
  { icon: "card" as const, title: "Stripe-powered payments", copy: "Pay through the existing BubsBookings checkout." },
];

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function loadHomepageServices(location: string, radius: number) {
  try {
    return await getServices(location ? { location, radiusMiles: radius, limit: 50 } : { limit: 50 });
  } catch (error) {
    console.error("Homepage service loading failed", error);
    return [];
  }
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const requestedLocation = getParam(params.location);
  const requestedDelivery = getParam(params.delivery).toUpperCase();
  const initialDelivery = requestedDelivery === "REMOTE" || requestedDelivery === "IN_PERSON" ? requestedDelivery : "ALL";
  const location = await getContextualLocation(requestedLocation);
  const requestedRadius = Number(getParam(params.radius));
  const radius = Number.isInteger(requestedRadius) && requestedRadius >= 1 && requestedRadius <= 250 ? requestedRadius : 25;
  const city = location.split(",")[0]?.trim() || "";
  const servicesWithinRange = await loadHomepageServices(location, radius);
  const featuredServices = servicesWithinRange.slice(0, 6);
  const nearbyParams = new URLSearchParams({ radius: String(radius) });
  if (location) nearbyParams.set("location", location);
  const nearbyServicesHref = `/services?${nearbyParams.toString()}#service-listings`;

  return (
    <main className="home-page home-redesign min-h-screen overflow-x-clip bg-[#f8f8f4] text-[#102d22]">
      <header className="home-header sticky top-0 z-50 border-b border-[#12382b]/8 bg-[#fbfcf8]/95 backdrop-blur-xl">
        <div className="narrow-mobile-header site-container flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="BubsBookings home" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <BrandLockup priority />
          </Link>
          <nav aria-label="Primary navigation" className="home-desktop-nav hidden items-center lg:flex">
            <Link href="/services">Find a Pro</Link>
            <Link href="/services?showFilters=1#all-filters">Browse Services</Link>
            <Link href="/#how-it-works">How It Works</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/providers/join">List Your Service</Link>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <MobileSiteNav />
            <div className="home-header-account"><AccountNav /></div>
          </div>
        </div>
      </header>

      <section className="home-hero-v2 relative">
        <div className="home-hero-v2-grid">
          <div className="home-hero-v2-copy">
            <p className="home-hero-eyebrow">Local and remote service marketplace</p>
            <h1 className="type-hero">
              Get things done with <span>local and online pros.</span>
            </h1>
            <p className="home-hero-copy">
              Book services for your home, business, or personal projects. Compare providers, message, and request a booking through BubsBookings.
            </p>
            <div className="home-hero-points" aria-label="Marketplace features">
              <span><UiIcon name="services" />Provider details</span>
              <span><UiIcon name="card" />Stripe payments</span>
              <span><UiIcon name="messages" />Direct messaging</span>
              <span><UiIcon name="calendar" />Easy booking</span>
            </div>
          </div>
          <HomeHeroPreview href={nearbyServicesHref} city={city} hasLocation={Boolean(location)} />
        </div>
        <div className="home-search-dock site-container px-4 sm:px-6">
          <HomeServiceSearch initialDelivery={initialDelivery} initialLocation={location} initialRadius={radius} restoreRemembered={!requestedLocation} />
        </div>
      </section>

      <section aria-labelledby="category-heading" className="home-discovery site-container px-4 sm:px-6">
        <div className="sr-only"><h2 id="category-heading">Browse service categories</h2></div>
        <div className="home-category-grid">
          {HOME_CATEGORIES.map((category) => {
            const categoryParams = new URLSearchParams({ category, radius: String(radius) });
            if (location) categoryParams.set("location", location);
            return (
              <Link key={category} href={`/services?${categoryParams.toString()}#service-listings`} className="home-category-card">
                <ServiceCategoryIcon category={category} />
                <span>{category}</span>
              </Link>
            );
          })}
          <Link href="/services?showFilters=1#all-filters" className="home-category-card home-category-more">
            <span aria-hidden="true" className="home-category-more-icon">•••</span>
            <span>More</span>
          </Link>
        </div>
      </section>

      <section className="home-popular site-container px-4 sm:px-6" aria-labelledby="popular-services-heading">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">Explore the marketplace</p>
            <h2 id="popular-services-heading" className="text-3xl font-bold tracking-[-.04em]">Popular services {city ? `near ${city}` : "on BubsBookings"}</h2>
          </div>
          <Link href={nearbyServicesHref}>View all services <UiIcon name="arrow-right" /></Link>
        </div>
        {featuredServices.length > 0 ? (
          <div className="home-popular-grid">
            {featuredServices.map((service) => <HomeServiceCard key={service.id} service={service} />)}
          </div>
        ) : (
          <div className="home-empty-state">
            <ServiceCategoryIcon category="Home repair" />
            <h3>Listings are coming soon</h3>
            <p>Browse all service categories or list your business as an early provider.</p>
            <Link href="/providers/join">Join as a provider</Link>
          </div>
        )}
      </section>

      <section id="how-it-works" className="home-how site-container scroll-mt-24 px-4 sm:px-6" aria-labelledby="how-heading">
        <div className="home-section-heading home-section-heading--stacked">
          <div>
            <p className="home-section-kicker">Simple from start to finish</p>
            <h2 id="how-heading" className="text-3xl font-bold tracking-[-.04em]">How BubsBookings works</h2>
            <p>Built for customers looking for local help and remote expertise.</p>
          </div>
        </div>
        <ol className="home-steps">
          <li><span className="home-step-number">1</span><UiIcon name="search" /><div><h3>Find a service</h3><p>Search real listings and compare provider details.</p></div></li>
          <li><span className="home-step-number">2</span><UiIcon name="messages" /><div><h3>Message or book</h3><p>Ask questions, request a quote, or choose an available booking option.</p></div></li>
          <li><span className="home-step-number">3</span><UiIcon name="card" /><div><h3>Pay through Stripe</h3><p>Complete an accepted booking through the BubsBookings checkout.</p></div></li>
        </ol>
      </section>

      <section className="home-benefit-band" aria-label="BubsBookings marketplace benefits">
        <div className="site-container grid px-4 sm:px-6">
          <div><UiIcon name="services" /><p><strong>Free listings</strong><span>Create a business page</span></p></div>
          <div><UiIcon name="messages" /><p><strong>No lead fees</strong><span>Message without a lead charge</span></p></div>
          <div><UiIcon name="share" /><p><strong>Marketing tools</strong><span>Use custom links and QR codes</span></p></div>
        </div>
      </section>

      <section className="home-why site-container px-4 sm:px-6" aria-labelledby="why-heading">
        <div className="home-section-heading home-section-heading--stacked">
          <div>
            <p className="home-section-kicker">Useful tools, clear choices</p>
            <h2 id="why-heading" className="text-3xl font-bold tracking-[-.04em]">Why choose BubsBookings?</h2>
          </div>
        </div>
        <div className="home-why-grid">
          {TRUST_POINTS.map((point) => (
            <article key={point.title}><UiIcon name={point.icon} /><h3>{point.title}</h3><p>{point.copy}</p></article>
          ))}
        </div>
      </section>

      <section className="home-provider-cta site-container px-4 sm:px-6">
        <div className="home-provider-cta-inner">
          <div>
            <p className="home-provider-eyebrow">Are you a service provider?</p>
            <h2>Grow your business with BubsBookings.</h2>
            <p>Create a free listing, get booked, and manage your business in one place.</p>
            <div className="home-provider-actions">
              <Link href="/providers/join">Join as a provider <UiIcon name="arrow-right" /></Link>
              <Link href="/pricing">See provider plans</Link>
            </div>
          </div>
          <div className="home-provider-image" aria-hidden="true">
            <Image src="/images/home-marketplace-hero.webp" alt="" fill sizes="(min-width: 1024px) 28vw, 0px" className="object-cover object-right" />
          </div>
        </div>
      </section>

      <section className="home-final-links site-container grid px-4 sm:px-6 md:grid-cols-2">
        <Link href="/promise"><UiIcon name="shield" /><span><strong>The BubsBookings Promise</strong><small>Read about provider information, payment tools, and booking support.</small></span><UiIcon name="arrow-right" /></Link>
        <Link href="/partners"><UiIcon name="share" /><span><strong>Partner Program</strong><small>Share BubsBookings. Earn when providers succeed.</small></span><UiIcon name="arrow-right" /></Link>
      </section>
    </main>
  );
}

function HomeServiceCard({ service }: { service: ServiceListing }) {
  const visual = getServiceVisual(service.category);
  const businessHref = service.companySlug ? `/companies/${service.companySlug}` : service.providerProfileVisible ? `/providers/${service.providerSlug}` : null;
  const locationLabel = service.deliveryType === "REMOTE" ? "Available online" : `${service.city}, ${service.state}`;
  return (
    <article className="home-service-card">
      <Link href={`/services/${service.slug}`} className="home-service-image" aria-label={`View ${service.title}`}>
        <div role={service.imageUrls[0] ? undefined : "img"} aria-label={service.imageUrls[0] ? undefined : `${service.title} cover`} className={service.imageUrls[0] ? "" : `bg-gradient-to-br ${visual.gradient}`}>
          {service.imageUrls[0] ? <Image src={service.imageUrls[0]} alt={`${service.title} cover`} fill loading="lazy" unoptimized sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, 16vw" className="object-cover" /> : <ServiceCategoryIcon category={service.category} />}
          <span className="home-listing-delivery">{service.deliveryType === "REMOTE" ? "Online" : service.deliveryType === "BOTH" ? "Local + online" : "In person"}</span>
        </div>
      </Link>
      <div className="home-service-card-content">
        <p className="home-service-category">{service.category}</p>
        <div className="home-service-card-summary">
          <div className="home-service-card-main">
            <Link href={`/services/${service.slug}`}><h3>{service.title}</h3></Link>
            {businessHref ? <Link href={businessHref} className="home-service-provider">{service.provider}</Link> : <p className="home-service-provider">{service.provider}</p>}
          </div>
          <div className="home-service-card-price">
            <p>{formatServicePrice(service)}</p>
            <span>{service.pricingType === "QUOTE_ONLY" ? "custom pricing" : service.pricingType === "HOURLY" ? `${formatDuration(service.minimumDurationMinutes ?? service.durationMinutes)} minimum` : "starting"}</span>
          </div>
        </div>
        <p className="home-service-location"><UiIcon name={service.deliveryType === "REMOTE" ? "globe" : "map-pin"} />{locationLabel}</p>
      </div>
      <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="home-service-favorite" />
    </article>
  );
}
