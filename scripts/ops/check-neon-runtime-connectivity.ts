import { config } from "dotenv";

config({ path: ".env", quiet: true });

type UrlClassification = {
  exists: boolean;
  parses: boolean;
  postgres: boolean;
  pooled: boolean;
  ssl: boolean;
};

function classifyUrl(name: string): UrlClassification {
  const value = process.env[name];
  const result: UrlClassification = {
    exists: Boolean(value),
    parses: false,
    postgres: false,
    pooled: false,
    ssl: false,
  };

  if (!value) return result;

  try {
    const url = new URL(value);
    result.parses = true;
    result.postgres = url.protocol === "postgres:" || url.protocol === "postgresql:";
    result.pooled = /pooler/i.test(url.hostname);
    result.ssl = url.searchParams.has("sslmode") || url.searchParams.has("ssl") || url.searchParams.has("channel_binding");
  } catch {
    result.parses = false;
  }

  return result;
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function passedFailed(value: boolean) {
  return value ? "passed" : "failed";
}

async function main() {
  const runtimeUrl = classifyUrl("DATABASE_URL");
  const directUrl = classifyUrl("DIRECT_URL");
  const urlsDistinct = Boolean(process.env.DATABASE_URL && process.env.DIRECT_URL && process.env.DATABASE_URL !== process.env.DIRECT_URL);

  console.log("Neon runtime configuration:");
  console.log(`- pooled application URL configured: ${yesNo(runtimeUrl.exists && runtimeUrl.parses && runtimeUrl.postgres && runtimeUrl.pooled)}`);
  console.log(`- direct migration URL configured: ${yesNo(directUrl.exists && directUrl.parses && directUrl.postgres && !directUrl.pooled)}`);
  console.log(`- URLs are distinct: ${yesNo(urlsDistinct)}`);
  console.log(`- pooled URL has SSL option: ${yesNo(runtimeUrl.ssl)}`);
  console.log(`- direct URL has SSL option: ${yesNo(directUrl.ssl)}`);

  if (!runtimeUrl.exists || !runtimeUrl.parses || !runtimeUrl.postgres || !runtimeUrl.pooled) {
    throw new Error("Pooled runtime database URL is not configured correctly.");
  }
  if (!directUrl.exists || !directUrl.parses || !directUrl.postgres || directUrl.pooled || !urlsDistinct) {
    throw new Error("Direct migration database URL is not configured correctly.");
  }

  const { prisma } = await import("../../lib/db-runtime");

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`- pooled runtime connectivity: ${passedFailed(true)}`);
    console.log(`- read-only Prisma query: ${passedFailed(true)}`);

    try {
      const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"`;
      console.log(`- migration metadata readable: ${passedFailed(Array.isArray(rows))}`);
    } catch {
      console.log(`- migration metadata readable: ${passedFailed(false)}`);
    }
  } catch {
    console.log(`- pooled runtime connectivity: ${passedFailed(false)}`);
    console.log(`- read-only Prisma query: ${passedFailed(false)}`);
    throw new Error("Read-only Neon runtime connectivity failed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Neon runtime connectivity check failed.");
  process.exit(1);
});
