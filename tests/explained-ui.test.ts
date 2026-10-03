import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(...parts:string[])=>readFileSync(new URL(`../${parts.join("/")}`,import.meta.url),"utf8");

test("shared explanations appear on hover, keyboard focus, and focus within links",()=>{
  const tooltip=read("components","explained-ui.tsx");
  assert.match(tooltip,/role="tooltip"/);
  assert.match(tooltip,/aria-describedby/);
  assert.match(tooltip,/group-hover:visible/);
  assert.match(tooltip,/group-focus:visible/);
  assert.match(tooltip,/group-focus-within:visible/);
});

test("affiliate compensation badges explain how each earning type works",()=>{
  const dashboard=read("app","affiliate","page.tsx");
  assert.match(dashboard,/id="activation-bonus-help"/);
  assert.match(dashboard,/eligible paid booking/);
  assert.match(dashboard,/id="revenue-share-help"/);
  assert.match(dashboard,/not the provider's service price/);
  assert.match(dashboard,/id="custom-campaign-help"/);
});

test("service details explain delivery, location, provider, and verification labels",()=>{
  const service=read("app","services","[slug]","page.tsx");
  for(const id of ["delivery-type-help","service-map-help","service-provider-help","business-location-help","profile-screened-help","email-verified-help","business-checked-help"]){
    assert.match(service,new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(service,/<span title="The provider/);
});
