import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import AccountNav from "@/components/account-nav";
import BrandLockup from "@/components/brand-lockup";
import FavoriteButton from "@/components/favorite-button";
import HomeProviderShowcase from "@/components/home-provider-showcase";
import HomeServiceSearch from "@/components/home-service-search";
import MobileSiteNav from "@/components/mobile-site-nav";
import ProfileAvatar from "@/components/profile-avatar";
import ServiceCategoryIcon from "@/components/service-category-icon";
import UiIcon from "@/components/ui-icon";
import { formatDuration, getServices, getServiceVisual, type ServiceListing } from "@/lib/marketplace";
import { getContextualLocation } from "@/lib/request-location";
import { publicPageMetadata } from "@/lib/seo";
import { formatServicePrice } from "@/lib/service-pricing";
import { normalizeSearchRadius } from "@/lib/search-radius";

export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata({
  title: "Find and book local or remote services",
  description: "Compare in-person and remote service listings, message providers, and request bookings across the United States.",
  pathname: "/",
});

const HOME_CATEGORIES = [
  { label: "Home services", category: "Home repair" },
  { label: "Auto services", category: "Car detailing" },
  { label: "Tech & digital", category: "Tech help" },
  { label: "Creative", category: "Photography" },
  { label: "Health & fitness", category: "Personal training" },
  { label: "Pet care", category: "Pet care" },
  { label: "Tutoring", category: "Tutoring" },
] as const;

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
  const radius = normalizeSearchRadius(requestedRadius);
  const city = location.split(",")[0]?.trim() || "";
  const servicesWithinRange = await loadHomepageServices(location, radius);
  const featuredServices = servicesWithinRange.slice(0, 4);
  const nearbyParams = new URLSearchParams({ radius: String(radius) });
  if (location) nearbyParams.set("location", location);
  if (initialDelivery !== "ALL") nearbyParams.set("delivery", initialDelivery);
  const nearbyServicesHref = `/services?${nearbyParams.toString()}#service-listings`;

  return (
    <main className="premium-home min-h-screen overflow-x-clip bg-[#faf9f4] text-[#102d22]">
      <section className="premium-hero" aria-labelledby="premium-home-heading">
        <Image src="/images/home-premium-hero.webp" alt="Modern lakeside home overlooking a mountain landscape" fill priority sizes="100vw" className="premium-hero-image object-cover" />
        <div className="premium-hero-shade" aria-hidden="true" />

        <header className="premium-home-header">
          <div className="narrow-mobile-header site-container flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <Link href="/" aria-label="BubsBookings home" className="premium-header-logo flex min-w-0 items-center gap-2.5"><BrandLockup priority /></Link>
            <nav aria-label="Primary navigation" className="premium-desktop-nav hidden items-center lg:flex">
              <Link href="/services">Find a Service</Link>
              <Link href="/providers/join">For Providers</Link>
              <Link href="/#how-it-works">How It Works</Link>
              <Link href="/guides">Resources</Link>
            </nav>
            <div className="premium-header-actions flex items-center gap-2">
              <Link href="/services" aria-label="Search services" className="premium-header-search hidden sm:grid"><UiIcon name="search" /></Link>
              <MobileSiteNav />
              <div className="home-header-account"><AccountNav /></div>
            </div>
          </div>
        </header>

        <div className="premium-hero-content site-container px-4 sm:px-6">
          <div className="premium-hero-copy">
            <p className="premium-eyebrow">Local and remote service marketplace</p>
            <h1 id="premium-home-heading">Get things <span>done.</span></h1>
            <p>Book local and online service providers for anything you need.</p>
          </div>
        </div>

        <div className="premium-search-dock site-container px-4 sm:px-6">
          <HomeServiceSearch initialDelivery={initialDelivery} initialLocation={location} initialRadius={radius} restoreRemembered={!requestedLocation} />
        </div>
      </section>

      <section aria-labelledby="category-heading" className="premium-categories site-container px-4 sm:px-6">
        <h2 id="category-heading" className="sr-only">Browse service categories</h2>
        <div className="premium-category-row">
          {HOME_CATEGORIES.map(({ label, category }) => {
            const categoryParams = new URLSearchParams({ category, radius: String(radius) });
            if (location) categoryParams.set("location", location);
            return (
              <Link key={category} href={`/services?${categoryParams.toString()}#service-listings`} className="premium-category-link">
                <span className="premium-category-icon"><ServiceCategoryIcon category={category} /></span>
                <span>{label}</span>
              </Link>
            );
          })}
          <Link href="/services?showFilters=1#all-filters" className="premium-category-link">
            <span className="premium-category-icon"><UiIcon name="more" className="h-7 w-7" /></span>
            <span>More</span>
          </Link>
        </div>
      </section>

      <section className="premium-featured site-container px-4 sm:px-6" aria-labelledby="featured-services-heading">
        <div className="premium-section-heading">
          <div><p>Featured services</p><h2 id="featured-services-heading">Explore services {city ? `near ${city}` : "on BubsBookings"}.</h2></div>
          <Link href={nearbyServicesHref}>Browse all services <UiIcon name="arrow-right" /></Link>
        </div>
        {featuredServices.length > 0 ? (
          <div className="premium-listing-grid">{featuredServices.map((service) => <PremiumServiceCard key={service.id} service={service} />)}</div>
        ) : (
          <div className="premium-empty-state">
            <ServiceCategoryIcon category="Home repair" />
            <h3>Listings are coming soon</h3>
            <p>Browse all service categories or list your business as an early provider.</p>
            <Link href="/providers/join">Create a free listing</Link>
          </div>
        )}
      </section>

      <section id="how-it-works" className="premium-how site-container scroll-mt-24 px-4 sm:px-6" aria-labelledby="how-heading">
        <div className="premium-how-heading"><p>How it works</p><h2 id="how-heading">From search to booked <span>in minutes.</span></h2></div>
        <ol className="premium-steps">
          <li><span className="premium-step-number">1</span><UiIcon name="search" /><div><h3>Find a Service</h3><p>Search and browse available providers.</p></div></li>
          <li><span className="premium-step-number">2</span><UiIcon name="messages" /><div><h3>Message or Book</h3><p>Ask questions, request a custom quote, or book directly.</p></div></li>
          <li><span className="premium-step-number">3</span><UiIcon name="card" /><div><h3>Pay Securely</h3><p>Complete your booking through Stripe.</p></div></li>
        </ol>
      </section>

      <section className="premium-provider site-container px-4 sm:px-6" aria-labelledby="provider-promo-heading">
        <div className="premium-provider-inner">
          <div className="premium-provider-copy">
            <p>For providers</p>
            <h2 id="provider-promo-heading">Your business. <span>All in one place.</span></h2>
            <p>Create a free business page, accept bookings, manage clients, and grow your business without paying for leads.</p>
            <Link href="/providers/join">Create a Free Listing <UiIcon name="arrow-right" /></Link>
          </div>
          <HomeProviderShowcase />
        </div>
      </section>
    </main>
  );
}

function PremiumServiceCard({ service }: { service: ServiceListing }) {
  const visual = getServiceVisual(service.category);
  const businessHref = service.companySlug ? `/companies/${service.companySlug}` : service.providerProfileVisible ? `/providers/${service.providerSlug}` : null;
  const locationLabel = service.deliveryType === "REMOTE" ? "Available online" : `${service.city}, ${service.state}`;
  const deliveryLabel = service.deliveryType === "REMOTE" ? "Online" : service.deliveryType === "BOTH" ? "Local + online" : "In person";
  return (
    <article className="premium-service-card">
      <Link href={`/services/${service.slug}`} className="premium-service-image" aria-label={`View ${service.title}`}>
        <div role={service.imageUrls[0] ? undefined : "img"} aria-label={service.imageUrls[0] ? undefined : `${service.title} cover`} className={service.imageUrls[0] ? "" : `bg-gradient-to-br ${visual.gradient}`}>
          {service.imageUrls[0] ? <Image src={service.imageUrls[0]} alt={`${service.title} cover`} fill loading="lazy" unoptimized sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) 50vw, 25vw" className="object-cover" /> : <ServiceCategoryIcon category={service.category} />}
          <span className="premium-listing-delivery">{deliveryLabel}</span>
        </div>
      </Link>
      <div className="premium-service-content">
        <p className="premium-service-category">{service.category}</p>
        <Link href={`/services/${service.slug}`}><h3>{service.title}</h3></Link>
        <div className="premium-provider-row">
          <ProfileAvatar name={service.provider} imageUrl={service.providerProfileImageUrl} className="premium-provider-avatar" />
          <div className="min-w-0">
            {businessHref ? <Link href={businessHref}>{service.provider}</Link> : <p>{service.provider}</p>}
            {service.providerReviewCount > 0 && service.providerAverageRating !== null ? (
              <p className="premium-service-rating" aria-label={`${service.providerAverageRating.toFixed(1)} out of 5 stars from ${service.providerReviewCount} verified ${service.providerReviewCount === 1 ? "review" : "reviews"}`}><span aria-hidden="true">★</span> {service.providerAverageRating.toFixed(1)} <small>({service.providerReviewCount})</small></p>
            ) : <p className="premium-service-rating is-new">New provider</p>}
          </div>
        </div>
        <div className="premium-service-meta">
          <p className="premium-service-location"><UiIcon name={service.deliveryType === "REMOTE" ? "globe" : "map-pin"} />{locationLabel}</p>
          <div className="premium-service-price"><strong>{formatServicePrice(service)}</strong><span>{service.pricingType === "QUOTE_ONLY" ? "custom pricing" : service.pricingType === "HOURLY" ? `${formatDuration(service.minimumDurationMinutes ?? service.durationMinutes)} minimum` : "starting"}</span></div>
        </div>
      </div>
      <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="premium-service-favorite" />
    </article>
  );
}
