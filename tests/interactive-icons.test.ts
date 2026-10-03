import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("shared interactive icons are platform-independent SVGs", () => {
  const source = read("components/ui-icon.tsx");
  assert.match(source, /viewBox="0 0 24 24"/);
  assert.match(source, /stroke="currentColor"/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /focusable="false"/);
});

test("reusable icon controls do not depend on Unicode font glyphs", () => {
  const files = [
    "components/back-button.tsx",
    "components/mobile-site-nav.tsx",
    "components/notification-bell.tsx",
    "components/listing-photo-gallery.tsx",
    "components/listing-share-button.tsx",
    "components/service-filters-menu.tsx",
    "components/us-city-selector.tsx",
    "components/report-user-button.tsx",
    "components/booking-date-picker.tsx",
    "components/booking-calendar.tsx",
    "components/contact-provider-link.tsx",
  ];
  const unsafeGlyph = /[×←→↗↻⌕⌁⌖▦▣◇◉◷□☆♙▤⚙✉🔔🔒🔐📍💳☰⚑‹›]/;
  for (const file of files) {
    const source = read(file);
    const controls = source.match(/<(?:button|Link|a)\b[^>]*>[\s\S]*?<\/(?:button|Link|a)>/g)?.join("\n") ?? "";
    assert.match(source, /UiIcon/);
    assert.doesNotMatch(controls, unsafeGlyph, `${file} contains a platform-dependent icon glyph`);
  }
});

test("customer and provider navigation use semantic SVG icon names", () => {
  const customer = read("app/account/page.tsx");
  for (const name of ["opportunities", "calendar", "card", "settings", "mail", "plus"]) {
    assert.match(customer, new RegExp(`name="${name}"`));
  }

  const provider = read("components/provider-dashboard-icon.tsx");
  assert.match(provider, /UiIcon/);
  assert.match(provider, /ProviderDashboardIconName/);
});
