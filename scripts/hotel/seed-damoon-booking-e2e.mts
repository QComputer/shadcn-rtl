import { randomBytes } from "node:crypto";
import { appendFileSync, lstatSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { approveHotelPublication } from "@/lib/hotel/services/hotel-publication.service";

function failClosedTarget() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Damoon E2E fixture seeding is forbidden in production");
  }
  if (process.env.DAMOON_E2E_ENABLED !== "1") {
    throw new Error("Set DAMOON_E2E_ENABLED=1 only in the disposable CI job");
  }
  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  if (!databaseUrl || databaseUrl !== directUrl) {
    throw new Error("DATABASE_URL and DIRECT_URL must be the same disposable test URL");
  }
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgresql:" || !["127.0.0.1", "::1", "localhost"].includes(parsed.hostname)) {
    throw new Error("E2E database URL must point to loopback PostgreSQL");
  }
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!/^damoon_[a-f0-9]{12,32}$/i.test(databaseName)) {
    throw new Error("E2E database name must be damoon_<unique hex run id>");
  }
  if (process.env.DAMOON_CI_DATABASE_NAME !== databaseName) throw new Error("DAMOON_CI_DATABASE_NAME must identify the same isolated database");
  const localMode = process.env.DAMOON_LOCAL_E2E === "1";
  const expectedPort = localMode ? process.env.LOCAL_PRISMA_EXPECTED_PORT : "5432";
  if (!expectedPort || parsed.port !== expectedPort) throw new Error("E2E PostgreSQL port must match the explicitly configured test port");
  if (parsed.searchParams.size !== 1 || parsed.searchParams.get("schema") !== "public" || parsed.hash) throw new Error("E2E database URL must select only the public schema");
  const suffix = databaseName.slice("damoon_".length);
  const databaseUser = decodeURIComponent(parsed.username);
  let localEnvFile;
  if (localMode) {
    if (parsed.hostname !== "127.0.0.1" || expectedPort === "5432" || databaseUser !== `damoon_test_${suffix}` || decodeURIComponent(parsed.password) === "postgres") {
      throw new Error("Local acceptance requires a dedicated role and a non-default loopback port");
    }
    localEnvFile = resolve(process.env.DAMOON_LOCAL_E2E_ENV_FILE || "");
    const tempRoot = resolve(tmpdir());
    const relativePath = relative(tempRoot, localEnvFile);
    const runDirectory = basename(dirname(localEnvFile));
    if (isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || basename(localEnvFile) !== "fixture.env" || !new RegExp(`^damoon-local-e2e-${suffix}$`, "i").test(runDirectory)) {
      throw new Error("Local fixture environment output must be fixture.env inside its unique OS temporary directory");
    }
    if (lstatSync(dirname(localEnvFile)).isSymbolicLink()) throw new Error("Local fixture output directory must not be a symbolic link");
  } else {
    if (!process.env.GITHUB_ENV) throw new Error("GITHUB_ENV is required in CI so fixture credentials remain step-scoped");
    if (process.env.LOCAL_PRISMA_EXPECTED_PORT && process.env.LOCAL_PRISMA_EXPECTED_PORT !== "5432") {
      throw new Error("Non-default PostgreSQL ports require the explicit DAMOON_LOCAL_E2E=1 local-test opt-in");
    }
  }
  return { databaseName, databaseUser, suffix, localMode, localEnvFile };
}

function isoDay(offset: number) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() + offset);
  return day;
}

async function createTenant(
  prisma: PrismaClient,
  suffix: string,
  key: "a" | "b",
  domainName: string,
  managerPassword: string,
) {
  const slug = `damoon-e2e-${suffix}-${key}`;
  const organization = await prisma.organization.create({
    data: { name: `Synthetic Damoon E2E ${key.toUpperCase()} ${suffix}`, slug, type: "SHOP", vertical: "HOTEL", capabilitiesInitializedAt: new Date() },
  });
  const property = await prisma.hotelProperty.create({
    data: { organizationId: organization.id, organizationSlug: slug, slug: "damoon-hotel", name: `Synthetic Hotel ${key.toUpperCase()}`, timezone: "Asia/Tehran", operationalMode: "REQUEST_ONLY" },
  });
  await prisma.organizationCapability.create({
    data: { organizationId: organization.id, key: "HOTEL_BOOKING", status: "ACTIVE", enabledAt: new Date() },
  });
  await prisma.organizationCapability.create({
    data: { organizationId: organization.id, key: "HOTEL_WEBSITE", status: "ACTIVE", enabledAt: new Date() },
  });
  await prisma.organizationDomain.create({
    data: {
      organizationId: organization.id,
      domain: domainName,
      normalizedDomain: domainName,
      kind: "APEX",
      type: "CUSTOM",
      status: "ACTIVE",
      isPrimary: true,
      providerVerified: true,
      dnsConfigured: true,
      sslReady: true,
      activatedAt: new Date(),
    },
  });

  const username = `damoon-e2e-${suffix}-${key}-manager`;
  const passwordHash = await bcrypt.hash(managerPassword, 10);
  const manager = await prisma.user.create({ data: { name: username, password: passwordHash, role: "MANAGER", isTeamMember: true, isActive: true } });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, organizationSlug: slug, userId: manager.id, role: "MANAGER", isActive: true },
  });

  return { organization, property, manager, username };
}

async function main() {
  const target = failClosedTarget();
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    const [identity] = await prisma.$queryRaw<Array<{
      databaseName: string; userName: string; schemaName: string; version: number;
    }>>`
      SELECT current_database() AS "databaseName", current_user AS "userName", current_schema() AS "schemaName",
             current_setting('server_version_num')::int AS version, inet_server_addr()::text AS address
    `;
    if (identity?.databaseName !== target.databaseName || identity.userName !== target.databaseUser || identity.schemaName !== "public" || identity.version < 170000 || identity.version >= 180000) {
      throw new Error("Connected target is not the expected isolated PostgreSQL 17 public database");
    }
    if (await prisma.organization.count() !== 0 || await prisma.user.count() !== 0 || await prisma.hotelProperty.count() !== 0) {
      throw new Error("Refusing to seed a database that already contains organizations, users, or Hotel properties");
    }

    const passwordA = randomBytes(24).toString("base64url");
    const passwordB = randomBytes(24).toString("base64url");
    const suffix = target.suffix.toLowerCase();
    const tenantA = await createTenant(prisma, suffix, "a", "damoon-hotel.localhost", passwordA);
    // The public-site routing test and domain-bound login test use separate
    // loopback-mapped hostnames belonging to the same disposable tenant.
    await prisma.organizationDomain.create({ data: {
      organizationId: tenantA.organization.id, domain: "damoon-hotel.ir", normalizedDomain: "damoon-hotel.ir",
      kind: "APEX", type: "CUSTOM", status: "ACTIVE", isPrimary: false,
      providerVerified: true, dnsConfigured: true, sslReady: true, activatedAt: new Date(),
    } });
    const tenantB = await createTenant(prisma, suffix, "b", `damoon-foreign-${suffix}.test`, passwordB);

    const adminSlug = `damoon-e2e-${suffix}-a-admin`;
    const admin = await prisma.user.create({
      data: { name: adminSlug, password: await bcrypt.hash(randomBytes(24).toString("base64url"), 10), role: "ADMIN", isTeamMember: true, isActive: true },
    });
    await prisma.organizationMember.create({
      data: { organizationId: tenantA.organization.id, organizationSlug: tenantA.organization.slug, userId: admin.id, role: "ADMIN", isActive: true },
    });

    const roomType = await prisma.hotelRoomType.create({
      data: {
        organizationId: tenantA.organization.id,
        propertyId: tenantA.property.id,
        slug: "double",
        name: "Synthetic double room",
        maxAdults: 2,
        maxChildren: 2,
        maxOccupancy: 4,
        beds: [{ kind: "queen", count: 1 }, { kind: "single", count: 1 }],
        totalAllotment: 2,
      },
    });
    const ratePlan = await prisma.hotelRatePlan.create({
      data: {
        organizationId: tenantA.organization.id,
        propertyId: tenantA.property.id,
        roomTypeId: roomType.id,
        code: "standard-flex",
        name: "Synthetic flexible rate",
        currency: "TOMAN",
        baseNightlyRate: BigInt(750_000),
        mealPlan: "none",
        minNights: 1,
        maxNights: 0,
        isActive: true,
      },
    });

    const inventory = Array.from({ length: 24 }, (_, index) => ({
      organizationId: tenantA.organization.id,
      propertyId: tenantA.property.id,
      roomTypeId: roomType.id,
      date: isoDay(index),
      allotment: 2,
      booked: 0,
      held: 0,
      outOfService: 0,
    }));
    await prisma.hotelInventory.createMany({ data: inventory });

    const scope = { availability: true, quote: false, policies: false };
    for (const resource of [
      { resourceType: "PROPERTY" as const, resourceId: tenantA.property.id },
      { resourceType: "ROOM_TYPE" as const, resourceId: roomType.id },
      { resourceType: "RATE_PLAN" as const, resourceId: ratePlan.id },
    ]) {
      await approveHotelPublication({
        organizationId: tenantA.organization.id,
        propertyId: tenantA.property.id,
        ...resource,
        scope,
        userId: admin.id,
        role: "ADMIN",
      }, prisma);
    }

    const values: Record<string, string> = {
      DAMOON_ORGANIZATION_ID: tenantA.organization.id,
      DAMOON_PROPERTY_ID: tenantA.property.id,
      DAMOON_PROPERTY_SLUG: tenantA.property.slug,
      DAMOON_MANAGER_USERNAME: tenantA.username,
      DAMOON_MANAGER_PASSWORD: passwordA,
      DAMOON_ROOM_TYPE_SLUG: roomType.slug,
      DAMOON_RATE_PLAN_CODE: ratePlan.code,
      DAMOON_FOREIGN_ORGANIZATION_ID: tenantB.organization.id,
      DAMOON_FOREIGN_PROPERTY_ID: tenantB.property.id,
      DAMOON_FOREIGN_HOST: `damoon-foreign-${suffix}.test`,
      DAMOON_FOREIGN_MANAGER_USERNAME: tenantB.username,
      DAMOON_FOREIGN_MANAGER_PASSWORD: passwordB,
      DAMOON_PUBLIC_HOST: "damoon-hotel.localhost:8080",
      DAMOON_PUBLIC_HOSTS: `damoon-hotel.localhost:8080,damoon-foreign-${suffix}.test:8080`,
      DAMOON_STANDALONE_URL: "http://damoon-hotel.localhost:8080",
      DAMOON_E2E_PUBLIC_PORT: "8080",
    };
    if (!target.localMode) for (const key of ["DAMOON_MANAGER_PASSWORD", "DAMOON_FOREIGN_MANAGER_PASSWORD"]) {
      console.log(`::add-mask::${values[key]}`);
    }
    const output = Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n") + "\n";
    if (target.localMode) writeFileSync(target.localEnvFile!, output, { encoding: "utf8", flag: "wx" });
    else appendFileSync(process.env.GITHUB_ENV!, output, { encoding: "utf8" });
    console.log(`Seeded two synthetic Hotel tenants in ${target.databaseName}; only tenant A has approved availability.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown fixture setup failure";
  console.error(`Damoon E2E fixture seeding failed: ${message}`);
  process.exitCode = 1;
});
