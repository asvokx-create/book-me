import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adminComponent = await readFile(new URL("../components/affiliate-admin.tsx", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../app/api/admin/affiliates/route.ts", import.meta.url), "utf8");

test("affiliate programs can be created and edited with visible failure feedback", () => {
  assert.match(adminComponent, /action:\s*"program_create"/);
  assert.match(adminComponent, /action:\s*"program_update"/);
  assert.match(adminComponent, /setProgramDialog\(program\)/);
  assert.match(adminComponent, /The program could not be saved\. Please try again\./);
  assert.match(adminRoute, /A program with that name already exists\./);
  assert.match(adminRoute, /action === "program_update"/);
  assert.match(adminRoute, /UPDATE affiliate_programs SET name=\$2,description=\$3/);
  assert.match(adminRoute, /program_updated/);
});

test("approval requires an explicit enabled affiliate program", () => {
  assert.match(adminComponent, /name="programId" required/);
  assert.match(adminComponent, /programs\.filter\(program=>program\.status==="enabled"/);
  assert.match(adminComponent, /programId:values\.programId/);
  assert.match(adminRoute, /SELECT 1 FROM affiliate_programs WHERE id::text=\$1 AND status='enabled'/);
  assert.match(adminRoute, /Choose an enabled affiliate program\./);
  assert.match(adminRoute, /programId: requestedProgramId\|\|null/);
});

test("program editing explains that existing referral snapshots are preserved", () => {
  assert.match(adminComponent, /Terms already snapshotted onto existing referrals are not rewritten\./);
  assert.doesNotMatch(adminRoute, /UPDATE affiliate_referrals SET/);
});
