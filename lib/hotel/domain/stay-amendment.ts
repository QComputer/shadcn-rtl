import { isPropertyDate, offsetPropertyDate } from "./property-calendar";

export type StayAmendmentNight = { date: string; roomId: string | null; rate: bigint };
export type StayAmendmentPlan = { added: string[]; removed: string[]; retained: string[]; dates: string[]; newRoomId: string; rates: bigint[]; total: bigint };

export function stayDatesBetween(from: string, to: string): string[] {
  if (!isPropertyDate(from) || !isPropertyDate(to) || to <= from || to > offsetPropertyDate(from, 31)) throw new Error("Stay is outside property limits");
  const dates: string[] = [];
  for (let date = from; date < to; date = offsetPropertyDate(date, 1)) dates.push(date);
  return dates;
}

/** Preserve historic room assignment and agreed nightly rate on every retained night. */
export function planStayAmendment(input: {
  oldCheckIn: string; oldCheckOut: string; checkIn: string; checkOut: string;
  today: string; status: string; nights: StayAmendmentNight[]; addedRates: ReadonlyMap<string, bigint>;
}): StayAmendmentPlan {
  const { oldCheckIn, oldCheckOut, checkIn, checkOut, today, status, nights, addedRates } = input;
  if (status !== "CONFIRMED" && status !== "CHECKED_IN") throw new Error("Invalid reception transition");
  if (!isPropertyDate(today)) throw new Error("Stay is outside property limits");
  if (status === "CONFIRMED" && checkIn < today) throw new Error("Stay is outside property limits: check-in precedes property today");
  if (status === "CHECKED_IN" && (oldCheckIn > today || oldCheckOut <= today || checkIn !== oldCheckIn || checkOut <= today)) throw new Error("STAY_AMENDMENT_ACTIVE_DATES");
  const oldDates = stayDatesBetween(oldCheckIn, oldCheckOut);
  const dates = stayDatesBetween(checkIn, checkOut);
  const old = new Map(nights.map(night => [night.date, night]));
  if (old.size !== nights.length || old.size !== oldDates.length || oldDates.some(date => !old.has(date) || old.get(date)!.rate < BigInt(0))) throw new Error("STAY_AMENDMENT_INTEGRITY");
  const active = nights.filter(night => status === "CONFIRMED" || night.date >= today);
  const rooms = new Set(active.map(night => night.roomId));
  if (rooms.size !== 1 || rooms.has(null)) throw new Error("Assign a room before check-in");
  const newRoomId = active[0]?.roomId;
  if (!newRoomId) throw new Error("Assign a room before check-in");
  const next = new Set(dates);
  const added = dates.filter(date => !old.has(date));
  const removed = oldDates.filter(date => !next.has(date));
  const retained = dates.filter(date => old.has(date));
  if (status === "CHECKED_IN" && removed.some(date => date <= today)) throw new Error("STAY_AMENDMENT_ACTIVE_DATES");
  const rates = dates.map(date => {
    const rate = old.get(date)?.rate ?? addedRates.get(date);
    if (rate === undefined || rate < BigInt(0)) throw new Error("STAY_AMENDMENT_INTEGRITY");
    return rate;
  });
  const total = rates.reduce((sum, rate) => sum + rate, BigInt(0));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Unsupported amount");
  return { added, removed, retained, dates, newRoomId, rates, total };
}
