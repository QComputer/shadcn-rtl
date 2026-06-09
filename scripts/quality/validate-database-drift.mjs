#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const expectedColumns = [
  {
    table: "Organization",
    column: "lat",
    expectedDataType: "double precision",
    reason: "Shop and public organization surfaces may select Organization.lat.",
  },
  {
    table: "Organization",
    column: "lng",
    expectedDataType: "double precision",
    reason: "Shop and public organization surfaces may select Organization.lng.",
  },
  {
    table: "OrganizationSettings",
    column: "deliveryFee",
    expectedDataType: "double precision",
    reason: "Order delivery-fee calculation reads OrganizationSettings.deliveryFee.",
  },
  {
    table: "Order",
    column: "organizationSlug",
    expectedDataType: "text",
    reason: "Current Prisma schema relates Order to Organization by organizationSlug.",
  },
  {
    table: "Order",
    column: "deletedAt",
    expectedDataType: "timestamp without time zone",
    reason: "Current Prisma schema includes Order.deletedAt and relation queries may select it.",
  },
];

function normalizeType(value) {
  return String(value ?? "").toLowerCase();
}

try {
  const rows = await prisma.$queryRaw`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Organization', 'OrganizationSettings', 'Order')
  `;

  const actual = new Map(
    rows.map((row) => [
      `${row.table_name}.${row.column_name}`,
      normalizeType(row.data_type),
    ]),
  );

  const results = expectedColumns.map((expected) => {
    const key = `${expected.table}.${expected.column}`;
    const actualDataType = actual.get(key);
    const ok = actualDataType === normalizeType(expected.expectedDataType);
    return {
      name: `${key} exists as ${expected.expectedDataType}`,
      ok,
      detail: ok ? "" : `actual=${actualDataType ?? "missing"}; ${expected.reason}`,
    };
  });

  console.table(results);
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(
      `Database drift validation failed with ${failed.length} issue(s). Run: pnpm run db:repair:known-drift`,
    );
    process.exit(1);
  }

  console.log("Database drift validation passed.");
} finally {
  await prisma.$disconnect();
}
