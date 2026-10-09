import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const form = readFileSync(join(process.cwd(), "app", "providers", "join", "onboarding-form.tsx"), "utf8");

test("hourly onboarding gives the duration input a step base that matches its booking increment", () => {
  assert.match(form, /min=\{pricingType === "HOURLY" \? String\(bookingIncrementHours\)/);
  assert.match(form, /step=\{pricingType === "HOURLY" \? String\(bookingIncrementHours\)/);
  assert.match(form, /onChange=\{\(event\) => setDurationAmount\(event\.target\.value\)\}/);
  const isStepAligned = (value: number, min: number, step: number) => Number.isInteger((value - min) / step);
  assert.equal(isStepAligned(1, 0.5, 0.5), true);
  assert.equal(isStepAligned(1, 0.25, 0.5), false);
});
