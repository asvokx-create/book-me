import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { edgeEnabledIndex, filterSelectOptions, nextEnabledIndex } from "../lib/custom-select-logic.ts";

const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1)));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    return statSync(target).isDirectory() ? sourceFiles(target) : /\.(?:tsx|ts)$/.test(entry) ? [target] : [];
  });
}

test("all application dropdowns use the shared custom control", () => {
  const files = [...sourceFiles(path.join(root, "app")), ...sourceFiles(path.join(root, "components"))];
  const nativeSelects = files.filter((file) => /<select\b/.test(readFileSync(file, "utf8")));
  assert.deepEqual(nativeSelects, []);

  const unlabeled: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/<CustomSelect\b[\s\S]*?>/g)) {
      if (!/\bariaLabel\s*=/.test(match[0])) unlabeled.push(file);
    }
  }
  assert.deepEqual(unlabeled, []);
});

test("the custom control owns its popup and full accessible interaction contract", () => {
  const component = readFileSync(path.join(root, "components", "custom-select.tsx"), "utf8");
  assert.match(component, /createPortal\([\s\S]*document\.body/);
  assert.match(component, /role="combobox"/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /aria-activedescendant=\{activeOptionId\}/);
  assert.match(component, /aria-selected=\{option\.value === currentValue\}/);
  assert.match(component, /event\.key === "ArrowDown"/);
  assert.match(component, /event\.key === "ArrowUp"/);
  assert.match(component, /event\.key === "Home"/);
  assert.match(component, /event\.key === "End"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key === "Tab"/);
  assert.match(component, /closest\("form"\)/);
  assert.match(component, /type="hidden" name=\{name\}/);
  assert.match(component, /addEventListener\("reset"/);
  assert.match(component, /getBoundingClientRect\(\)/);
  assert.match(component, /openAbove/);
  assert.match(component, /window\.addEventListener\("scroll"/);
});

test("keyboard navigation wraps and skips disabled choices", () => {
  const options = [{ textValue: "One" }, { textValue: "Two", disabled: true }, { textValue: "Three" }];
  assert.equal(edgeEnabledIndex(options), 0);
  assert.equal(edgeEnabledIndex(options, true), 2);
  assert.equal(nextEnabledIndex(options, 0, 1), 2);
  assert.equal(nextEnabledIndex(options, 2, 1), 0);
  assert.equal(nextEnabledIndex(options, 0, -1), 2);
});

test("search matches labels and descriptions and preserves original option values", () => {
  const options = [
    { textValue: "In person", description: "At the customer's address", value: "IN_PERSON" },
    { textValue: "Remote", description: "Online delivery", value: "REMOTE" },
  ];
  assert.deepEqual(filterSelectOptions(options, "customer"), [options[0]]);
  assert.deepEqual(filterSelectOptions(options, "REMOTE"), [options[1]]);
  assert.deepEqual(filterSelectOptions(options, "missing"), []);
  assert.equal(filterSelectOptions(options, "online")[0]?.value, "REMOTE");
});

test("popup styles cover layering, dark mode, scrolling, and mobile-size touch targets", () => {
  const component = readFileSync(path.join(root, "components", "custom-select.tsx"), "utf8");
  const styles = readFileSync(path.join(root, "app", "globals.css"), "utf8");
  assert.match(styles, /\.custom-select-menu\s*\{\s*z-index:\s*360/);
  assert.match(styles, /html\[data-theme="dark"\] \.custom-select-menu/);
  assert.match(styles, /html\[data-theme="dark"\] \.custom-select-option/);
  assert.match(component, /min-h-11/);
  assert.match(component, /overflow-y-auto/);
  assert.match(component, /maxHeight: position\.maxHeight/);
  assert.match(styles, /\.input\.custom-select-trigger\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/);
});
