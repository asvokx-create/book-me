import { triggerScheduledOperations } from "../lib/payout-cron-trigger.mjs";
import { assertPatchedNodeRuntime } from "./verify-node-runtime.mjs";

try {
  assertPatchedNodeRuntime();
  const result = await triggerScheduledOperations();
  console.log(JSON.stringify({ ok: true, scheduledOperations: result }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "The scheduled operations job failed.");
  process.exitCode = 1;
}
