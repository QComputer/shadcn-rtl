import dotenv from "dotenv";
import { validateLocalPrismaEnvironment } from "./db/guard-local-prisma-env.mjs";

dotenv.config({ path: ".env.local" });

const result = validateLocalPrismaEnvironment(process.env);
console.log(JSON.stringify(result, null, 2));

if (result.ok) {
  console.log("\n✅ Local Prisma environment is valid for localhost");
  const dbUrl = new URL(process.env.DATABASE_URL || "");
  const directUrl = new URL(process.env.DIRECT_URL || "");
  console.log(`  DATABASE_URL  = ${dbUrl.hostname}:${dbUrl.port}/${dbUrl.pathname.replace(/^\//, "")}`);
  console.log(`  DIRECT_URL    = ${directUrl.hostname}:${directUrl.port}/${directUrl.pathname.replace(/^\//, "")}`);
  console.log(`  Expected port = ${process.env.LOCAL_PRISMA_EXPECTED_PORT}`);
} else {
  console.log("\n❌ Local Prisma environment is INVALID");
  console.log("  Errors:", result.errors);
}
