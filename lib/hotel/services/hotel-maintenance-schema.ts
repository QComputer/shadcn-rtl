import { Prisma } from "@prisma/client";

export const HOTEL_MAINTENANCE_SCHEMA_NOT_READY = "HOTEL_MAINTENANCE_SCHEMA_NOT_READY";

/** Match only Prisma's exact missing maintenance relation; never mask other database errors. */
export function isMissingHotelMaintenanceTableError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const meta = error.meta as Record<string, unknown> | undefined;
  const table = typeof meta?.table === "string" ? meta.table.replaceAll('"', "") : "";
  if (error.code === "P2021") return table === "HotelRoomMaintenanceBlock" || table === "public.HotelRoomMaintenanceBlock";
  if (error.code === "P2010" && meta?.code === "42P01") {
    return typeof meta?.message === "string" && meta.message.includes("HotelRoomMaintenanceBlock") && /does not exist/i.test(meta.message);
  }
  return false;
}
