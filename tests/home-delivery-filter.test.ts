import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(...parts:string[])=>readFileSync(new URL(`../${parts.join("/")}`,import.meta.url),"utf8");

test("homepage delivery filter uses an accessible custom listbox instead of OS select chrome",()=>{
  const component=read("components","home-service-search.tsx");
  const customSelect=read("components","custom-select.tsx");
  const styles=read("app","globals.css");
  assert.match(component,/home-search-delivery-select/);
  assert.match(component,/<CustomSelect ariaLabel="Service delivery type"/);
  assert.doesNotMatch(component,/<select[^>]*aria-label="Service delivery type"/);
  assert.match(customSelect,/aria-haspopup="listbox"/);
  assert.match(customSelect,/role="listbox"/);
  assert.match(customSelect,/role="option"/);
  assert.match(customSelect,/event\.key === "ArrowDown"/);
  assert.match(customSelect,/event\.key === "Escape"/);
  assert.match(styles,/\.home-search-delivery-select[\s\S]*?background: transparent !important/);
  assert.match(styles,/\.home-search-delivery:focus-within/);
  assert.match(styles,/html\[data-theme="dark"\] \.home-search-delivery/);
});

test("desktop search bar uses the available hero width without crowding its controls",()=>{
  const component=read("components","home-service-search.tsx");
  assert.match(component,/w-full max-w-6xl/);
  assert.match(component,/xl:min-w-\[300px\]/);
  assert.match(component,/xl:min-w-\[220px\]/);
  assert.match(component,/xl:min-w-\[365px\]/);
  assert.doesNotMatch(component,/home-search-bar[^\n]*max-w-5xl/);
});

test("delivery filter uses matching icons for any, in-person, and remote modes",()=>{
  const component=read("components","home-service-search.tsx");
  assert.match(component,/function DeliveryIcon/);
  assert.match(component,/delivery === "IN_PERSON"/);
  assert.match(component,/delivery === "REMOTE"/);
  assert.doesNotMatch(component,/>◉</);
});
