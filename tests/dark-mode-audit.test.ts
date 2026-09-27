import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("dark accent text only changes when an accent background is active", () => {
  const css = read("app/globals.css");
  assert.match(css, /\[class~="bg-\[#eee25a\]"\]/);
  assert.doesNotMatch(css, /html\[data-theme="dark"\] :where\(\s*\[class\*="bg-\[#eee25a\]"\]/);
  assert.match(css, /\[class~="hover:bg-\[#eee25a\]"\][\s\S]*?\):hover/);
  assert.match(css, /\):not\(\[class\*="hover:bg-"\]\)/);
});

test("dark mode has explicit surfaces for the audited visual exceptions", () => {
  const css = read("app/globals.css");
  for (const selector of [
    ".partners-hero",
    ".message-thread-surface",
    ".home-preview-badge",
    ".trust-badge--verified",
    ".trust-badge--warning",
  ]) assert.match(css, new RegExp(selector.replace(".", "\\.")));

  assert.match(css, /:-webkit-autofill/);
  assert.match(css, /radial-gradient\(circle_at_85%_15%/);
  assert.match(read("app/partners/page.tsx"), /className="partners-hero /);
  assert.match(read("components/messaging-center.tsx"), /className="message-thread-surface /);
  assert.match(read("components/messaging-center.tsx"), /className="grid gap-3 border-b/);
  assert.match(read("app/page.tsx"), /className="home-preview-badge /);
  assert.match(read("app/services/[slug]/page.tsx"), /trust-badge--verified/);
  assert.match(read("components/brand-wordmark.tsx"), /text-\[\.9rem\] min-\[360px\]:text-\[1\.05rem\]/);
});

test("dark palette pairs retain accessible text contrast", () => {
  const rgb = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map((part) => Number.parseInt(part, 16));
  const luminance = (hex: string) => {
    const [red, green, blue] = rgb(hex).map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const contrast = (foreground: string, background: string) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };

  assert.ok(contrast("#eef5f0", "#0d1813") >= 7);
  assert.ok(contrast("#adbbb3", "#15251e") >= 4.5);
  assert.ok(contrast("#183126", "#eee25a") >= 4.5);
  assert.ok(contrast("#a9e3ba", "#19392a") >= 4.5);
  assert.ok(contrast("#f4df83", "#3a3217") >= 4.5);
});
