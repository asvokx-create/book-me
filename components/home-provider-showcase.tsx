import BrandMark from "@/components/brand-mark";
import ServiceCategoryIcon from "@/components/service-category-icon";
import UiIcon from "@/components/ui-icon";

export default function HomeProviderShowcase() {
  return (
    <figure className="premium-provider-showcase" aria-labelledby="provider-showcase-caption">
      <div className="premium-laptop" aria-hidden="true">
        <div className="premium-laptop-camera" />
        <div className="premium-laptop-screen">
          <aside>
            <BrandMark className="h-7 w-7" />
            <span className="is-active"><UiIcon name="overview" /> Dashboard</span>
            <span><UiIcon name="calendar" /> Bookings</span>
            <span><UiIcon name="messages" /> Messages</span>
            <span><UiIcon name="services" /> Services</span>
          </aside>
          <div className="premium-laptop-content">
            <div className="premium-laptop-heading">
              <div><small>Provider workspace</small><strong>Good morning</strong></div>
              <span>View page</span>
            </div>
            <div className="premium-laptop-stats">
              <div><UiIcon name="calendar" /><span>Bookings</span><strong>Manage</strong></div>
              <div><UiIcon name="messages" /><span>Messages</span><strong>Reply</strong></div>
              <div><UiIcon name="services" /><span>Services</span><strong>Update</strong></div>
            </div>
            <div className="premium-laptop-panel">
              <strong>Today&apos;s schedule</strong>
              <span><i /> Upcoming booking</span>
              <span><i /> Customer follow-up</span>
              <span><i /> Availability review</span>
            </div>
          </div>
        </div>
        <div className="premium-laptop-base" />
      </div>

      <div className="premium-phone" aria-hidden="true">
        <div className="premium-phone-speaker" />
        <div className="premium-phone-screen">
          <div className="premium-phone-brand"><BrandMark className="h-5 w-5" /><span>BubsBookings</span></div>
          <div className="premium-phone-cover"><ServiceCategoryIcon category="Home repair" /></div>
          <strong>Your business page</strong>
          <small>Share your custom link</small>
          <div className="premium-qr-code">
            {Array.from({ length: 25 }, (_, index) => <i key={index} className={index % 3 === 0 || index % 7 === 0 ? "is-filled" : ""} />)}
          </div>
          <span className="premium-phone-action">Share page</span>
        </div>
      </div>
      <figcaption id="provider-showcase-caption">Illustrative preview of BubsBookings provider tools.</figcaption>
    </figure>
  );
}
