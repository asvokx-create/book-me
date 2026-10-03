import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(...parts:string[])=>readFileSync(new URL(`../${parts.join("/")}`,import.meta.url),"utf8");

test("homepage delivery filter uses one consistent surface without browser select chrome",()=>{
  const component=read("components","home-service-search.tsx");
  const styles=read("app","globals.css");
  assert.match(component,/home-search-delivery-select/);
  assert.match(styles,/\.home-search-delivery-select[\s\S]*?background: transparent !important/);
  assert.match(styles,/\.home-search-delivery:focus-within/);
  assert.match(styles,/html\[data-theme="dark"\] \.home-search-delivery/);
});

test("delivery filter uses matching icons for any, in-person, and remote modes",()=>{
  const component=read("components","home-service-search.tsx");
  assert.match(component,/function DeliveryIcon/);
  assert.match(component,/delivery === "IN_PERSON"/);
  assert.match(component,/delivery === "REMOTE"/);
  assert.doesNotMatch(component,/>◉</);
});
