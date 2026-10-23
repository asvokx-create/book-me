import { pathToFileURL } from "node:url";

const PATCHED_MINIMUMS = new Map([
  [22, [22, 23, 4]],
  [24, [24, 22, 1]],
  [26, [26, 12, 1]],
]);

function parseVersion(version) {
  const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return null;
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function isPatchedNodeRuntime(version) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  const minimum = PATCHED_MINIMUMS.get(parsed[0]);
  return Boolean(minimum && compareVersions(parsed, minimum) >= 0);
}

export function assertPatchedNodeRuntime(version = process.versions.node) {
  if (!isPatchedNodeRuntime(version)) {
    throw new Error(
      `Refusing to run on Node.js ${version}. Use a patched supported release: 22.23.4+, 24.22.1+, or 26.12.1+.`,
    );
  }
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = assertPatchedNodeRuntime();
  console.log(`Node.js ${version} satisfies the October 2026 security baseline.`);
}
