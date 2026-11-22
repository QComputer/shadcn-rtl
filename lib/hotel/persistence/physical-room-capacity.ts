import type { StayDate } from "@/lib/hotel/domain/types";
import type { TenantScope } from "@/lib/hotel/persistence/hotel-repositories";
import type { Prisma, PrismaClient } from "@prisma/client";

type Database = PrismaClient | Prisma.TransactionClient;

export type PhysicalRoomNightCapacity = {
  roomTypeId: string;
  totalRooms: number;
  availableRooms: number;
  availableByNight: Readonly<Record<string, number>>;
};

/**
 * Counts active physical capacity for each requested night. Date-scoped
 * maintenance reduces a room type once per room/night; permanent out-of-service
 * rooms are already excluded from availableRooms and are never subtracted twice.
 */
export async function getPhysicalRoomCapacitiesForNights(
  db: Database,
  scope: TenantScope,
  propertyId: string,
  roomTypeIds: readonly string[],
  nights: readonly StayDate[],
): Promise<PhysicalRoomNightCapacity[]> {
  if (!roomTypeIds.length || !nights.length) return [];

  const types = await db.hotelRoomType.findMany({
    where: { organizationId: scope.organizationId, propertyId, id: { in: [...roomTypeIds] } },
    select: { id: true },
  });
  const ownedTypeIds = types.map((type) => type.id);
  if (!ownedTypeIds.length) return [];

  const rooms = await db.hotelRoom.findMany({
    where: { organizationId: scope.organizationId, propertyId, roomTypeId: { in: ownedTypeIds } },
    select: { id: true, roomTypeId: true, isActive: true, deletedAt: true, isOutOfService: true },
  });
  const roomsByType = new Map<string, typeof rooms>();
  for (const room of rooms) roomsByType.set(room.roomTypeId, [...(roomsByType.get(room.roomTypeId) ?? []), room]);

  const activeRooms = rooms.filter((room) => room.isActive && room.deletedAt === null && !room.isOutOfService);
  const from = nights.reduce((minimum, night) => night < minimum ? night : minimum);
  const lastNight = nights.reduce((maximum, night) => night > maximum ? night : maximum);
  const to = new Date(new Date(`${lastNight}T00:00:00.000Z`).getTime() + 86_400_000);
  const blocks = activeRooms.length
    ? await db.hotelRoomMaintenanceBlock.findMany({
      where: {
        organizationId: scope.organizationId,
        propertyId,
        releasedAt: null,
        roomId: { in: activeRooms.map((room) => room.id) },
        from: { lt: to },
        to: { gt: new Date(`${from}T00:00:00.000Z`) },
      },
      select: { roomId: true, from: true, to: true },
    })
    : [];

  return ownedTypeIds.flatMap((roomTypeId) => {
    const configured = roomsByType.get(roomTypeId) ?? [];
    if (!configured.length) return [];
    const sellable = configured.filter((room) => room.isActive && room.deletedAt === null && !room.isOutOfService);
    const activeRoomIds = new Set(sellable.map((room) => room.id));
    const availableByNight = Object.fromEntries(nights.map((night) => {
      const at = new Date(`${night}T00:00:00.000Z`);
      const maintained = new Set(blocks.filter((block) => activeRoomIds.has(block.roomId) && block.from <= at && block.to > at).map((block) => block.roomId));
      return [night, Math.max(0, sellable.length - maintained.size)];
    }));
    return [{ roomTypeId, totalRooms: configured.length, availableRooms: sellable.length, availableByNight }];
  });
}
