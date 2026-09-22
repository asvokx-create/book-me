import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

test("hover styles do not move interactive hit areas", () => {
  const motionUtility = /(?<!group-)hover:(?:-?translate(?:-[xy])?-[^\s"'`}]+|scale-[^\s"'`}]+|rotate-[^\s"'`}]+|skew-[^\s"'`}]+)/g;
  const offenders = [...sourceFiles(join(projectRoot, "app")), ...sourceFiles(join(projectRoot, "components"))]
    .flatMap((path) => [...readFileSync(path, "utf8").matchAll(motionUtility)].map((match) => `${path}: ${match[0]}`));

  assert.deepEqual(offenders, []);
});

test("the shared hover guard keeps controls stationary while retaining visual feedback", () => {
  const css = readFileSync(join(projectRoot, "app", "globals.css"), "utf8");

  assert.match(css, /transition-property: color, background-color, border-color, box-shadow, opacity, filter !important/);
  assert.doesNotMatch(css, /:hover\s*\{[^}]*\b(?:transform|translate|scale)\s*:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
