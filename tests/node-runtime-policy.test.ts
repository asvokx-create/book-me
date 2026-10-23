import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assertPatchedNodeRuntime, isPatchedNodeRuntime } from "../scripts/verify-node-runtime.mjs";

test("Node runtime policy rejects vulnerable October 2026 releases", () => {
  for (const version of ["22.14.0", "22.23.3", "24.15.0", "24.22.0", "26.12.0", "25.9.0", "invalid"]) {
    assert.equal(isPatchedNodeRuntime(version), false, version);
    assert.throws(() => assertPatchedNodeRuntime(version), /Refusing to run/);
  }
});

test("Node runtime policy accepts patched supported releases", () => {
  for (const version of ["22.23.4", "22.24.0", "24.22.1", "24.23.0", "26.12.1", "26.13.0"]) {
    assert.equal(isPatchedNodeRuntime(version), true, version);
    assert.equal(assertPatchedNodeRuntime(version), version);
  }
});

test("deployment and CI pin Node.js 24.22.1", async () => {
  const [packageJson, lockfile, workflow, localVersion] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/security-checks.yml", import.meta.url), "utf8"),
    readFile(new URL("../.node-version", import.meta.url), "utf8"),
  ]);

  assert.equal(JSON.parse(packageJson).engines.node, "24.22.1");
  assert.equal(JSON.parse(lockfile).packages[""].engines.node, "24.22.1");
  assert.match(workflow, /node-version: 24\.22\.1/);
  assert.equal(localVersion.trim(), "24.22.1");
});
