import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const globalForPrisma = globalThis as unknown as {
  bazarBazPrisma: PrismaClient | undefined;
};

function getRuntimeDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Database runtime configuration is missing DATABASE_URL.");
  }
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error("Database runtime configuration must use a PostgreSQL URL.");
  }
  return databaseUrl;
}

function createPrismaClient() {
  neonConfig.webSocketConstructor = ws;

  const adapter = new PrismaNeon({
    connectionString: getRuntimeDatabaseUrl(),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.bazarBazPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.bazarBazPrisma = prisma;
}

// Soft delete helper functions
// Note: Prisma 6.x removed the $use middleware. Soft delete must be handled at the service layer.
// Use these helper functions in your service queries:
// - addSoftDeleteFilter() - adds { deletedAt: null } to where clauses
// - softDelete() - sets deletedAt to current date for soft delete

export const softDelete = {
  /**
   * Add soft delete condition to where clause
   */
  addFilter: <T extends Record<string, unknown>>(where: T = {} as T): T => {
    return { ...where, deletedAt: null } as T;
  },

  /**
   * Create soft delete data
   */
  createData: () => {
    return { deletedAt: new Date() };
  },

  /**
   * Models that support soft delete
   */
  models: [
    "Organization",
    "User",
    "ServiceCategory",
    "Service",
    "Appointment",
    "ProductCategory",
    "Product",
    "ProductVariant",
    "Order",
    "OrderItem",
  ] as const,
};

export default prisma;
