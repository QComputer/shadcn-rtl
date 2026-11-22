export type HotelRoomBoardRoom = {
  id: string;
  code: string;
  roomTypeId: string;
  isOutOfService: boolean;
};

export type HotelRoomBoardReservation = {
  reference: string;
  status: "CONFIRMED" | "CHECKED_IN";
  nights: Array<{ date: string; roomId: string | null }>;
};

export type HotelRoomBoardCell = {
  status: "VACANT" | "OUT_OF_SERVICE" | "RESERVED" | "OCCUPIED" | "OUT_OF_SERVICE_CONFLICT" | "MAINTENANCE" | "MAINTENANCE_CONFLICT";
  reference: string | null;
};

/** Build a read-only, half-open date board from persisted room-night allocations. */
export function buildHotelRoomBoard(input: {
  from: string;
  to: string;
  rooms: readonly HotelRoomBoardRoom[];
  reservations: readonly HotelRoomBoardReservation[];
  maintenanceBlocks?: ReadonlyArray<{ roomId: string; from: string; to: string }>;
}) {
  const dates: string[] = [];
  for (let value = new Date(`${input.from}T00:00:00.000Z`); value < new Date(`${input.to}T00:00:00.000Z`); value.setUTCDate(value.getUTCDate() + 1)) {
    dates.push(value.toISOString().slice(0, 10));
  }

  const allocated = new Map<string, HotelRoomBoardCell>();
  let unassignedReservationNights = 0;
  for (const reservation of input.reservations) {
    for (const night of reservation.nights) {
      if (!night.roomId) {
        unassignedReservationNights += 1;
        continue;
      }
      const key = `${night.roomId}\u0000${night.date}`;
      allocated.set(key, {
        status: reservation.status === "CHECKED_IN" ? "OCCUPIED" : "RESERVED",
        reference: reservation.reference,
      });
    }
  }

  return {
    dates,
    rooms: [...input.rooms].sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true })).map((room) => ({
      ...room,
      nights: dates.map((date) => {
        const allocation = allocated.get(`${room.id}\u0000${date}`);
        const underMaintenance = (input.maintenanceBlocks ?? []).some((block) => block.roomId === room.id && date >= block.from && date < block.to);
        if (underMaintenance && allocation) return { date, status: "MAINTENANCE_CONFLICT" as const, reference: allocation.reference };
        if (underMaintenance) return { date, status: "MAINTENANCE" as const, reference: null };
        if (room.isOutOfService && allocation) return { date, status: "OUT_OF_SERVICE_CONFLICT" as const, reference: allocation.reference };
        if (room.isOutOfService) return { date, status: "OUT_OF_SERVICE" as const, reference: null };
        return { date, ...(allocation ?? { status: "VACANT" as const, reference: null }) };
      }),
    })),
    unassignedReservationNights,
  };
}
