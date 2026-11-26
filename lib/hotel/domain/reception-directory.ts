import { normalizeReceptionSearch } from "./reception-professional";

export const RECEPTION_DIRECTORY_PAGE_SIZE = 25;
export const RECEPTION_DIRECTORY_MAX_PAGE = 400;
export function receptionDirectoryTokens(query: string): string[] | null {
  const tokens = normalizeReceptionSearch(query).split(/\s+/).filter(Boolean);
  if (query.length > 120 || tokens.length === 0 || tokens.length > 8 || tokens.join("").length < 2 || /[\u0000-\u001f\u007f]/.test(query)) return null;
  return [...new Set(tokens)];
}
export type ReceptionDirectoryRow = {
  id: string; reference: string; status: string; checkIn: string; checkOut: string;
  guests: Array<{ id: string; fullName: string; isPrimary: boolean; isChild: boolean; age: number | null }>;
  rooms: string[];
};
export type ReceptionDirectoryResult = {
  rows: ReceptionDirectoryRow[]; page: number; hasMore: boolean; pageLimitReached: boolean;
  basis?: "LINKED_CUSTOMER" | "CONTACT" | "RESERVATION_ONLY";
};
