import { prisma } from "@/lib/db";
import {
  CAFE_LEO_FIXTURE_PATH,
  CAFE_LEO_ORGANIZATION_SLUG,
  ensureLocalCafeLeoOrganization,
  importCafeLeoCatalog,
  readCafeLeoExtractionFixture,
} from "../../prisma/seed-data/cafe-leo-menu";

function argValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const fixturePath = argValue("--fixture") ?? CAFE_LEO_FIXTURE_PATH;
  const organizationSlug = argValue("--organization-slug") ?? CAFE_LEO_ORGANIZATION_SLUG;
  const ensureLocalTenant = process.argv.includes("--ensure-local-tenant");
  const updateBusinessProfile = process.argv.includes("--update-business-profile");

  if (ensureLocalTenant) {
    await ensureLocalCafeLeoOrganization(prisma, organizationSlug);
  }

  const fixture = readCafeLeoExtractionFixture(fixturePath);
  const result = await importCafeLeoCatalog(prisma, {
    fixture,
    organizationSlug,
    updateBusinessProfile,
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
