export const MAX_GROUP_ROOMS = 8;
export const GROUP_PAGE_SIZE = 25;
export function distinctGroupRooms(rooms: readonly { roomId: string }[]) {
  return rooms.length >= 2 && rooms.length <= MAX_GROUP_ROOMS && new Set(rooms.map(room => room.roomId)).size === rooms.length;
}
// A stable type/physical-room order reduces competing multi-room lock cycles.
export function orderGroupRooms<T extends { roomTypeId: string; roomId: string }>(rooms: readonly T[]): T[] {
  const cmp = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return [...rooms].sort((a, b) => cmp(a.roomTypeId, b.roomTypeId) || cmp(a.roomId, b.roomId));
}
export function validGroupReference(value: string) {
  return /^HG-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(value);
}
