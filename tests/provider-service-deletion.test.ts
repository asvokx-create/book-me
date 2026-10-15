import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("providers can delete a service from their dashboard after confirming the action", () => {
  const dashboard = read("components", "provider-dashboard.tsx");

  assert.match(dashboard, /setServicePendingDeletion\(service\)/);
  assert.match(dashboard, /Delete listing/);
  assert.match(dashboard, /Delete this listing\?/);
  assert.match(dashboard, /method: "DELETE"/);
  assert.match(dashboard, /“\$\{service\.title\}” was deleted and is no longer visible in customer searches\./);
  assert.match(dashboard, /createPortal\(/);
});

test("the listing deletion endpoint keeps server-side ownership and retires only the provider's listing", () => {
  const route = read("app", "api", "providers", "services", "[serviceId]", "route.ts");

  assert.match(route, /p\.user_id = \$2/);
  assert.match(route, /UPDATE services SET is_active = false/);
  assert.match(route, /WHERE id::text = \$1/);
});
