/** Does not load dotenv or contact any provider unless explicitly invoked in live mode. */
import { customerAuthSmsRuntimeAvailable, runCustomerAuthSmsOutboxBatch } from "../../lib/customer-auth/sms-runtime.server";

const args = new Set(process.argv.slice(2));
const live = args.has("--once") && args.has("--allow-live-sms");
if ([...args].some(value => !["--check", "--once", "--allow-live-sms"].includes(value)) ||
    (args.has("--once") !== args.has("--allow-live-sms")) || (live && args.has("--check"))) {
  console.error("CUSTOMER_SMS_WORKER_INVALID_ARGUMENTS");
  process.exitCode = 1;
} else if (!live) {
  console.log(JSON.stringify({ mode: "CHECK_ONLY", available: customerAuthSmsRuntimeAvailable(), providerContacted: false }));
} else if (!customerAuthSmsRuntimeAvailable()) {
  console.error("CUSTOMER_SMS_WORKER_DISABLED");
  process.exitCode = 1;
} else {
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  try {
    console.log(JSON.stringify(await runCustomerAuthSmsOutboxBatch({ limit: 10, signal: controller.signal })));
  } catch {
    // Driver/provider errors may contain credentials. Never print the raw error.
    console.error("CUSTOMER_SMS_WORKER_FAILED");
    process.exitCode = 1;
  } finally {
    try {
      const { prisma } = await import("../../lib/db");
      await prisma.$disconnect();
    } catch {
      console.error("CUSTOMER_SMS_WORKER_CLEANUP_FAILED");
      process.exitCode = 1;
    }
  }
}
