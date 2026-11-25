import { isPropertyDate } from "./property-calendar";

/** No-show is a manual staff decision after the arrival civil day, never an automatic job. */
export function canMarkManualNoShow(input: { status: string; checkIn: string; today: string; checkedInAt?: Date | string | null }): boolean {
  return input.status === "CONFIRMED" && !input.checkedInAt && isPropertyDate(input.checkIn) && isPropertyDate(input.today) && input.checkIn < input.today;
}

/** Normalize common Persian/Arabic letter and digit variants without fuzzy identity matching. */
export function normalizeReceptionSearch(value: string): string {
  return value.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[٠-٩۰-۹]/g, character => String(character.charCodeAt(0) - (character >= "۰" ? 0x6f0 : 0x660)))
    .replace(/[\u064b-\u065f\u0670\u200c\u200d]/g, "").trim().toLowerCase();
}
export function matchesReceptionSearch(query: string, fields: readonly (string | null | undefined)[]): boolean {
  const tokens = normalizeReceptionSearch(query).split(/\s+/).filter(Boolean);
  const haystack = fields.map(field => normalizeReceptionSearch(field ?? "")).join(" ");
  return tokens.every(token => haystack.includes(token));
}

export const RECEPTION_HISTORY_ACTIONS = ["CREATE_MANUAL_RESERVATION", "reserve", "confirm-reservation", "assign-room", "move-room", "amend-stay", "check-in", "check-out", "cancel", "mark-no-show", "expire"] as const;
export type ReceptionHistoryAction = typeof RECEPTION_HISTORY_ACTIONS[number];
export type ReceptionHistoryEvent = { id: string; reservationId: string; action: ReceptionHistoryAction; at: string };
export function projectReceptionHistory(rows: ReadonlyArray<{ id: string; createdAt: Date; resultJson: unknown }>, reservationIds: ReadonlySet<string>): ReceptionHistoryEvent[] {
  const output: ReceptionHistoryEvent[] = [];
  for (const row of rows) {
    if (!row.resultJson || typeof row.resultJson !== "object" || Array.isArray(row.resultJson)) continue;
    const value = row.resultJson as Record<string, unknown>;
    const action = value.action;
    if (typeof action !== "string" || !RECEPTION_HISTORY_ACTIONS.some(candidate => candidate === action)) continue;
    const nested = value.reservation;
    const reservationId = typeof value.reservationId === "string" ? value.reservationId : nested && typeof nested === "object" && !Array.isArray(nested) ? (nested as Record<string, unknown>).id : undefined;
    if (typeof reservationId !== "string" || !reservationIds.has(reservationId)) continue;
    output.push({ id: row.id, reservationId, action: action as ReceptionHistoryAction, at: row.createdAt.toISOString() });
  }
  return output;
}
