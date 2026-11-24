import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
export { HOTEL_MAINTENANCE_SCHEMA_NOT_READY, isMissingHotelMaintenanceTableError } from "./hotel-maintenance-schema";
export const HOTEL_STAY_REQUEST_SCHEMA_MIGRATION = "20261114130000_hotel_operational_modes_and_stay_requests";
export const HOTEL_OPERATIONAL_RESERVATION_SCHEMA_MIGRATIONS = [
  "20261114130000_hotel_operational_modes_and_stay_requests",
  "20261114140000_hotel_offline_payments",
  "20261114150000_hotel_reservation_payment_policy",
  "20261114160000_hotel_pending_payment_deadline",
  "20261114170000_hotel_offline_payment_audit",
] as const;
function isMissingSchema(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return ["P2021", "P2022"].includes(error.code);
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && ["P2021", "P2022"].includes(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /relation .* does not exist|column .* does not exist|no such table|no such column|Undefined table|Undefined column|Unknown arg|does not exist in the current database/i.test(message);
}
async function detectStayRequestSchema(db: PrismaClient | Prisma.TransactionClient) {
  const rows = await db.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
    SELECT (
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'HotelProperty' AND column_name = 'operationalMode')
      AND to_regclass(format('%I.%I', current_schema(), 'HotelStayQuote')) IS NOT NULL
      AND to_regclass(format('%I.%I', current_schema(), 'HotelStayRequest')) IS NOT NULL
    ) AS ready`);
  return Boolean(rows[0]?.ready);
}
async function detectOperationalReservationSchema(db: PrismaClient | Prisma.TransactionClient) {
  const rows = await db.$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
    SELECT (
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'HotelProperty' AND column_name = 'operationalMode')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'HotelProperty' AND column_name = 'manualConfirmationPolicy')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'HotelProperty' AND column_name = 'allowedOfflinePaymentMethods')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'HotelProperty' AND column_name = 'minimumVerifiedDepositAmount')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'HotelProperty' AND column_name = 'pendingPaymentMinutes')
      AND to_regclass(format('%I.%I', current_schema(), 'HotelStayQuote')) IS NOT NULL
      AND to_regclass(format('%I.%I', current_schema(), 'HotelStayRequest')) IS NOT NULL
      AND to_regclass(format('%I.%I', current_schema(), 'HotelOfflinePayment')) IS NOT NULL
      AND to_regclass(format('%I.%I', current_schema(), 'HotelOfflinePaymentAuditEvent')) IS NOT NULL
    ) AS ready`);
  return Boolean(rows[0]?.ready);
}
async function isReady(db: PrismaClient | Prisma.TransactionClient, feature: "stay-request" | "operational-reservation") {
  try {
    return feature === "stay-request" ? await detectStayRequestSchema(db) : await detectOperationalReservationSchema(db);
  } catch (error) {
    if (isMissingSchema(error)) return false;
    throw error;
  }
}
export async function assertHotelStayRequestSchemaReady(db: PrismaClient | Prisma.TransactionClient) {
  if (await isReady(db, "stay-request")) return;
  throw new ApiError(503, "Hotel guest stay requests are not available until pending Hotel migrations are applied");
}
export async function assertHotelOperationalReservationSchemaReady(db: PrismaClient | Prisma.TransactionClient) {
  if (await isReady(db, "operational-reservation")) return;
  throw new ApiError(503, "Operational reservations are not available until pending Hotel migrations are applied");
}
export function isHotelSchemaMissingError(error: unknown) { return isMissingSchema(error); }
