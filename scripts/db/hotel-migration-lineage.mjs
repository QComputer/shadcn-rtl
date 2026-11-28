import { createHash } from "node:crypto";
import assert from "node:assert/strict";

export const CHECKPOINT = "20261114120000_hotel_guest_request_rate_limits";
export const PR192_CHECKPOINT = "20261126180000_hotel_reception_waitlist";
export const PROOF_MIGRATION = "20261127130000_hotel_guest_reservation_proof";
export const HISTORICAL = ["20261114130000_hotel_operational_modes_and_stay_requests", "20261114140000_hotel_offline_payments", "20261114150000_hotel_reservation_payment_policy", "20261114160000_hotel_pending_payment_deadline", "20261114170000_hotel_offline_payment_audit", "20261120160000_hotel_reservation_occupancy", "20261121120000_hotel_draft_accommodations", "20261121130000_hotel_guest_request_preferred_category", "20261121140000_hotel_draft_accommodation_promotion", "20261122110000_hotel_room_maintenance_blocks"];
const digest = names => createHash("sha256").update(names.join("\n")).digest("hex");
export function validateLineage(names) {
  assert.deepEqual(names, [...names].sort(), "migration lineage must be ordered");
  assert.equal(new Set(names).size, names.length, "duplicate migration");

  const anchor = names.indexOf(CHECKPOINT), pr192 = names.indexOf(PR192_CHECKPOINT);
  assert.ok(anchor >= 0 && pr192 > anchor, "required checkpoint missing");
  assert.equal(digest(names.slice(0, anchor + 1)), "e838610de071c54067a03340284f9537154a99db1cb1d1a423eedbbd163b24a2", "historical checkpoint lineage changed");
  assert.deepEqual(names.slice(anchor + 1, anchor + 1 + HISTORICAL.length), HISTORICAL, "reviewed historical sequence changed");
  assert.equal(digest(names.slice(0, pr192 + 1)), "99a1282915c589a18244a38edc2ad7d62185f1d8bd3270dcd6c27dbf62a134dc", "PR192 lineage changed");
  assert.equal(names[pr192 + 1], PROOF_MIGRATION, "proof migration must immediately follow PR192");
  return { preGap: names.slice(0, anchor + 1), pending: names.slice(anchor + 1), pr192: names.slice(0, pr192 + 1), afterPr192: names.slice(pr192 + 1) };
}
