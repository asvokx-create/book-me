import Link from "next/link";
import ServiceCategoryIcon from "@/components/service-category-icon";
import UiIcon from "@/components/ui-icon";

type HomeHeroPreviewProps = {
  href: string;
  city?: string;
  hasLocation: boolean;
};

export default function HomeHeroPreview({ href, city, hasLocation }: HomeHeroPreviewProps) {
  const categories = ["Home repair", "Photography", "Consulting", "Tutoring"];
  const [servicesHref] = href.split("#");

  function categoryHref(category: string) {
    const separator = servicesHref.includes("?") ? "&" : "?";
    return `${servicesHref}${separator}category=${encodeURIComponent(category)}#service-listings`;
  }

  return (
    <div className="home-hero-collage relative block overflow-hidden">
      <div className="home-hero-explore">
        <p className="home-hero-explore-kicker">Explore BubsBookings</p>
        <h2>Find the right help for the job.</h2>
        <div className="home-hero-explore-grid">
          {categories.map((category) => (
            <Link
              key={category}
              href={categoryHref(category)}
              aria-label={`Browse ${category.toLocaleLowerCase()} services${hasLocation && city ? ` near ${city}` : ""}`}
            >
              <ServiceCategoryIcon category={category} />
              <strong>{category}</strong>
            </Link>
          ))}
        </div>
        <Link
          href={href}
          aria-label={hasLocation && city ? `Browse all services available near ${city}` : "Browse all available services"}
          className="home-hero-explore-action"
        >
          Browse {hasLocation && city ? `services near ${city}` : "all services"}
          <UiIcon name="arrow-right" />
        </Link>
      </div>
    </div>
  );
}
