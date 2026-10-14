import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("critical form loaders use safe messages for unexpected client failures", () => {
  const settings = read("app/account/settings/settings-form.tsx");
  const listing = read("app/provider/services/[serviceId]/edit/listing-editor.tsx");
  const requests = read("components/job-request-center.tsx");
  const datePicker = read("components/booking-date-picker.tsx");

  assert.match(settings, /We couldn't load your account settings\. Refresh the page and try again\./);
  assert.match(listing, /We couldn't load this listing\. Refresh the page and try again\./);
  assert.match(requests, /Service requests are temporarily unavailable\. Please try again\./);
  assert.match(datePicker, /We couldn't load availability\. Please try again\./);
});
