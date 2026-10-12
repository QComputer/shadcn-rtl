import type {
  CancellationPolicySet,
  HotelProperty,
  PhysicalRoom,
  RatePlan,
  Reservation,
  ReservationCancellationPolicySnapshot,
  ReservationGuest,
  RoomType,
  SeasonalRate,
  StayDate,
  TomanAmount,
} from "@/lib/hotel/domain/types";
import type {
  HoldRecord,
  HoldReleaseResult,
  HotelAvailabilityRepository,
  HotelBookingRepository,
  HotelCatalogueRepository,
  HotelPaymentSubjectRepository,
  InventoryClaimResult,
  PaymentApplicationResult,
  PaymentSubjectRecord,
  PersistedInventoryNight,
  ReservationRecord,
  ReservationUpdateResult,
  TenantScope,
} from "@/lib/hotel/persistence/hotel-repositories";

/**
 * DEVELOPMENT-ONLY in-memory hotel persistence.
 *
 * This is a test double. It exists so booking rules, inventory accounting and
 * tenant isolation can be verified without a database, and it MUST NOT be
 * wired into any route, service or production entry point. The real
 * implementation must satisfy the same contract using a single serializable
 * PostgreSQL transaction per claim.
 *
 * What it can and cannot prove:
 *  - CAN prove domain behaviour, inventory accounting, state-machine wiring,
 *    idempotency of compare-and-set, and tenant isolation.
 *  - CANNOT prove database-level concurrency safety. Every mutation here runs
 *    through one awaited queue, which models serialization; it does not
 *    reproduce Postgres row locks, isolation levels or constraint violations.
 *    Database-backed concurrency verification is deferred to the migration
 *    milestone (H3).
 */

/**
 * The public contracts are deeply `readonly`, but the double must mutate its
 * stored rows. Keeping a private mutable view preserves the readonly contract
 * for callers without weakening it for the implementation.
 */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type InventoryKey = string;

function inventoryKey(roomTypeId: string, date: StayDate): InventoryKey {
  return `${roomTypeId}::${date}`;
}

export type InMemorySeed = {
  readonly property: HotelProperty
  readonly roomTypes: readonly RoomType[]
  readonly physicalRooms?: readonly PhysicalRoom[]
  readonly ratePlans: readonly RatePlan[]
  readonly seasonalRates?: readonly SeasonalRate[]
  readonly cancellationPolicies?: readonly CancellationPolicySet[]
  readonly inventory: readonly PersistedInventoryNight[]
};

type InventoryCell = {
  propertyId: string
  roomTypeId: string
  date: StayDate
  allotment: number
  booked: number
  held: number
  outOfService: number
  closedToArrival: boolean
  closedToDeparture: boolean
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryHotelRepositories
  implements HotelCatalogueRepository, HotelAvailabilityRepository, HotelBookingRepository, HotelPaymentSubjectRepository
{
  private readonly propertyBySlug = new Map<string, HotelProperty>();
  private readonly roomTypesByProperty = new Map<string, RoomType[]>();
  private readonly roomsByProperty = new Map<string, PhysicalRoom[]>();
  private readonly ratePlansByProperty = new Map<string, RatePlan[]>();
  private readonly policiesByProperty = new Map<string, CancellationPolicySet[]>();
  private seasonalRates: SeasonalRate[] = [];

  private readonly inventory = new Map<InventoryKey, InventoryCell>();
  private readonly holds = new Map<string, Mutable<HoldRecord>>();
  private readonly reservations = new Map<string, Mutable<ReservationRecord>>();
  private readonly payments = new Map<string, Mutable<PaymentSubjectRecord>>();

  /** Serializes every mutation so tests observe a consistent order. */
  private queue: Promise<unknown> = Promise.resolve();

  private enqueue<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  constructor(seed: InMemorySeed) {
    const organizationId = seed.property.organizationId;
    this.propertyBySlug.set(`${organizationId}::${seed.property.slug}`, seed.property);
    this.roomTypesByProperty.set(seed.property.id, [...seed.roomTypes]);
    this.roomsByProperty.set(seed.property.id, [...(seed.physicalRooms ?? [])]);
    this.ratePlansByProperty.set(seed.property.id, [...seed.ratePlans]);
    this.policiesByProperty.set(seed.property.id, [...(seed.cancellationPolicies ?? [])]);
    this.seasonalRates = [...(seed.seasonalRates ?? [])];

    for (const row of seed.inventory) {
      this.inventory.set(inventoryKey(row.roomTypeId, row.date), {
        propertyId: row.propertyId,
        roomTypeId: row.roomTypeId,
        date: row.date,
        allotment: row.allotment,
        booked: row.booked,
        held: row.held,
        outOfService: row.outOfService,
        closedToArrival: row.closedToArrival,
        closedToDeparture: row.closedToDeparture,
      });
    }
  }

  // ---------------------------------------------------------------- catalogue

  async findPropertyBySlug(scope: TenantScope, slug: string): Promise<HotelProperty | null> {
    return this.propertyBySlug.get(`${scope.organizationId}::${slug}`) ?? null;
  }

  async listRoomTypes(scope: TenantScope, propertyId: string): Promise<readonly RoomType[]> {
    if (this.ownsProperty(scope, propertyId)) return [...(this.roomTypesByProperty.get(propertyId) ?? [])];
    return [];
  }

  async findRoomTypeBySlug(scope: TenantScope, propertyId: string, slug: string): Promise<RoomType | null> {
    const found = (await this.listRoomTypes(scope, propertyId)).find((roomType) => roomType.slug === slug);
    return found ?? null;
  }

  async listPhysicalRooms(scope: TenantScope, propertyId: string): Promise<readonly PhysicalRoom[]> {
    if (!this.ownsProperty(scope, propertyId)) return [];
    return [...(this.roomsByProperty.get(propertyId) ?? [])];
  }

  async listRatePlans(scope: TenantScope, propertyId: string): Promise<RatePlan[]> {
    if (!this.ownsProperty(scope, propertyId)) return [];
    return [...(this.ratePlansByProperty.get(propertyId) ?? [])];
  }

  async listSeasonalRates(_scope: TenantScope, ratePlanIds: readonly string[]): Promise<readonly SeasonalRate[]> {
    return this.seasonalRates.filter((rate) => ratePlanIds.includes(rate.ratePlanId));
  }

  async listCancellationPolicies(scope: TenantScope, propertyId: string): Promise<readonly CancellationPolicySet[]> {
    if (!this.ownsProperty(scope, propertyId)) return [];
    return [...(this.policiesByProperty.get(propertyId) ?? [])];
  }

  async resolveRatePlanCancellationPolicy(scope: TenantScope, ratePlanId: string): Promise<ReservationCancellationPolicySnapshot | null> {
    for (const [propertyId, plans] of this.ratePlansByProperty) {
      const plan = plans.find((candidate) => candidate.id === ratePlanId && candidate.isActive);
      if (!plan || plan.propertyId !== propertyId) continue;
      if (plan.cancellationPolicy) return { ...plan.cancellationPolicy, organizationId: scope.organizationId, policyVersion: 1, capturedAt: new Date().toISOString() };
    }
    return null;
  }

  private ownsProperty(scope: TenantScope, propertyId: string): boolean {
    for (const property of this.propertyBySlug.values()) {
      if (property.id === propertyId) return property.organizationId === scope.organizationId;
    }
    return false;
  }

  // ------------------------------------------------------------- availability

  async getInventoryNights(
    scope: TenantScope,
    propertyId: string,
    roomTypeIds: readonly string[],
    nights: readonly StayDate[],
  ): Promise<readonly PersistedInventoryNight[]> {
    if (!this.ownsProperty(scope, propertyId)) return [];
    const rows: PersistedInventoryNight[] = [];
    for (const roomTypeId of roomTypeIds) {
      for (const date of nights) {
        const cell = this.inventory.get(inventoryKey(roomTypeId, date));
        rows.push({
          propertyId,
          date,
          roomTypeId,
          allotment: cell?.allotment ?? 0,
          booked: cell?.booked ?? 0,
          held: cell?.held ?? 0,
          outOfService: cell?.outOfService ?? 0,
          closedToArrival: cell?.closedToArrival ?? false,
          closedToDeparture: cell?.closedToDeparture ?? false,
        });
      }
    }
    return rows;
  }

  // ------------------------------------------------------------------ booking

  async claimInventoryForHold(input: {
    scope: TenantScope
    propertyId: string
    roomTypeId: string
    nights: readonly StayDate[]
    quantity: number
    holdId: string
    expiresAt: Date
    now: Date
  }): Promise<InventoryClaimResult> {
    return this.enqueue(async () => {
      if (!this.ownsProperty(input.scope, input.propertyId)) {
        return { isClaimed: false, reason: "TENANT_MISMATCH", failedDates: input.nights };
      }

      // Two-phase, all-or-nothing: validate every night before mutating any.
      const failedDates: StayDate[] = [];
      for (const date of input.nights) {
        const cell = this.inventory.get(inventoryKey(input.roomTypeId, date));
        if (!cell || this.sellable(cell, input.now) < input.quantity) {
          failedDates.push(date);
          continue;
        }
        if (cell.closedToArrival || cell.closedToDeparture) failedDates.push(date);
      }
      if (failedDates.length > 0) {
        return {
          isClaimed: false,
          reason: failedDates.some((date) => {
            const cell = this.inventory.get(inventoryKey(input.roomTypeId, date));
            return cell?.outOfService;
          })
            ? "OUT_OF_SERVICE"
            : "NO_INVENTORY",
          failedDates,
        };
      }

      for (const date of input.nights) {
        const cell = this.inventory.get(inventoryKey(input.roomTypeId, date))!;
        cell.held += input.quantity;
      }

      return {
        isClaimed: true,
        claims: input.nights.map((date) => ({ date, roomTypeId: input.roomTypeId })),
      };
    });
  }

  async claimInventoryAndCreateHold(input: {
    scope: TenantScope;
    propertyId: string;
    roomTypeId: string;
    nights: readonly StayDate[];
    quantity: number;
    hold: Omit<HoldRecord, "id"> & { id: string };
    now: Date;
  }): Promise<InventoryClaimResult & { readonly hold?: HoldRecord }> {
    const claim = await this.claimInventoryForHold({
      scope: input.scope,
      propertyId: input.propertyId,
      roomTypeId: input.roomTypeId,
      nights: input.nights,
      quantity: input.quantity,
      holdId: input.hold.id,
      expiresAt: input.hold.expiresAt,
      now: input.now,
    });
    if (!claim.isClaimed) return claim;
    const saved = await this.createHold(input.hold);
    return { ...claim, hold: saved };
  }

  private sellable(cell: InventoryCell, now: Date): number {
    if (cell.closedToArrival || cell.closedToDeparture) return 0;
    void now;
    return Math.max(0, cell.allotment - cell.booked - cell.held - cell.outOfService);
  }

  async createHold(input: Omit<HoldRecord, "id"> & { id: string }): Promise<HoldRecord> {
    return this.enqueue(async () => {
      const record: HoldRecord = { ...input, status: "ACTIVE" };
      this.holds.set(record.id, record);
      return record;
    });
  }

  async findHold(scope: TenantScope, holdId: string): Promise<HoldRecord | null> {
    const hold = this.holds.get(holdId);
    if (!hold || hold.organizationId !== scope.organizationId) return null;
    return hold;
  }

  async findHoldByReference(scope: TenantScope, reference: string): Promise<HoldRecord | null> {
    for (const hold of this.holds.values()) {
      if (hold.reference === reference && hold.organizationId === scope.organizationId) return hold;
    }
    return null;
  }

  async listExpiredActiveHolds(
    scope: TenantScope,
    input: { propertyId?: string; now: Date; limit: number },
  ): Promise<readonly HoldRecord[]> {
    const due: HoldRecord[] = [];
    for (const hold of this.holds.values()) {
      if (hold.organizationId !== scope.organizationId) continue;
      if (hold.status !== "ACTIVE") continue;
      if (hold.expiresAt.getTime() > input.now.getTime()) continue;
      if (input.propertyId && hold.propertyId !== input.propertyId) continue;
      due.push(hold);
    }
    return due.slice(0, input.limit);
  }

  async releaseHold(scope: TenantScope, holdId: string, now: Date): Promise<HoldReleaseResult> {
    return this.enqueue(async () => {
      const hold = this.holds.get(holdId);
      if (!hold) return { isReleased: false, reason: "NOT_FOUND" };
      if (hold.organizationId !== scope.organizationId) {
        return { isReleased: false, reason: "TENANT_MISMATCH" };
      }
      if (hold.status !== "ACTIVE") return { isReleased: false, reason: "ALREADY_CONSUMED" };

      for (const date of hold.nights) {
        const cell = this.inventory.get(inventoryKey(hold.roomTypeId, date));
        if (cell) cell.held = Math.max(0, cell.held - hold.quantity);
      }
      hold.status = now.getTime() >= hold.expiresAt.getTime() ? "EXPIRED" : "RELEASED";
      return { isReleased: true };
    });
  }

  async createReservation(record: ReservationRecord): Promise<ReservationRecord> {
    return this.enqueue(async () => {
      this.reservations.set(record.id, record);
      // Consuming a hold moves `held` to `booked` on every night.
      const hold = record.holdId ? this.holds.get(record.holdId) : undefined;
      if (hold && hold.status === "ACTIVE") {
        for (const date of hold.nights) {
          const cell = this.inventory.get(inventoryKey(hold.roomTypeId, date));
          if (cell) {
            cell.held = Math.max(0, cell.held - hold.quantity);
            cell.booked += hold.quantity;
          }
        }
        hold.status = "CONSUMED";
      }
      return record;
    });
  }

  async findReservation(scope: TenantScope, reservationId: string): Promise<ReservationRecord | null> {
    const record = this.reservations.get(reservationId);
    if (!record || record.organizationId !== scope.organizationId) return null;
    return record;
  }

  async findReservationByReference(scope: TenantScope, reference: string): Promise<ReservationRecord | null> {
    for (const record of this.reservations.values()) {
      if (record.reference === reference && record.organizationId === scope.organizationId) return record;
    }
    return null;
  }

  async updateReservationStatus(input: {
    scope: TenantScope
    reservationId: string
    expectedStatus: readonly Reservation["status"][]
    nextStatus: Reservation["status"]
    now: Date
    patch?: Partial<Pick<ReservationRecord, "paymentRequestPublicId" | "cancellationPolicySnapshot">>
  }): Promise<ReservationUpdateResult> {
    return this.enqueue(async () => {
      const record = this.reservations.get(input.reservationId);
      if (!record) return { isUpdated: false, reason: "NOT_FOUND" };
      if (record.organizationId !== input.scope.organizationId) {
        return { isUpdated: false, reason: "TENANT_MISMATCH" };
      }
      if (!input.expectedStatus.includes(record.status)) {
        return { isUpdated: false, reason: "STATUS_CONFLICT" };
      }
      const next: ReservationRecord = {
        ...record,
        ...(input.patch ?? {}),
        status: input.nextStatus,
        updatedAt: input.now,
      };
      this.reservations.set(input.reservationId, next);
      return { isUpdated: true, reservation: next };
    });
  }

  /** Test helper: releases the committed booking back into sellable stock. */
  releaseCommittedInventory(reservationId: string, now: Date): void {
    const record = this.reservations.get(reservationId);
    if (!record) return;
    for (const date of record.nights) {
      const cell = this.inventory.get(inventoryKey(record.roomTypeId, date));
      if (cell) cell.booked = Math.max(0, cell.booked - 1);
    }
    record.status = "CANCELLED";
    record.updatedAt = now;
  }

  // ------------------------------------------------------------------ payment

  async findByPublicId(scope: TenantScope, publicId: string): Promise<PaymentSubjectRecord | null> {
    const record = this.payments.get(publicId);
    if (!record || record.organizationId !== scope.organizationId) return null;
    return record;
  }

  async listForReservation(scope: TenantScope, reservationId: string): Promise<readonly PaymentSubjectRecord[]> {
    return [...this.payments.values()].filter(
      (record) =>
        record.reservationId === reservationId && record.organizationId === scope.organizationId,
    );
  }

  /** Registers a payment subject. Test setup only. */
  seedPayment(record: PaymentSubjectRecord): void {
    this.payments.set(record.paymentRequestPublicId, record);
  }

  async applyVerifiedPayment(input: {
    scope: TenantScope
    reservationId: string
    paymentRequestPublicId: string
    paidAt: Date
    amountToman: bigint
    now: Date
  }): Promise<PaymentApplicationResult> {
    return this.enqueue(async () => {
      const reservation = this.reservations.get(input.reservationId);
      if (!reservation) return { isApplied: false, reason: "NOT_FOUND" };
      if (reservation.organizationId !== input.scope.organizationId) {
        return { isApplied: false, reason: "TENANT_MISMATCH" };
      }

      const payment = this.payments.get(input.paymentRequestPublicId);
      if (!payment || payment.organizationId !== input.scope.organizationId) {
        return { isApplied: false, reason: "NOT_FOUND" };
      }
      if (payment.reservationId !== input.reservationId) {
        return { isApplied: false, reason: "AMOUNT_MISMATCH" };
      }
      if (payment.amountToman !== input.amountToman) {
        return { isApplied: false, reason: "AMOUNT_MISMATCH" };
      }

      // Idempotent replay: an already-paid request applied again is a no-op,
      // never a second confirmation.
      if (payment.status === "PAID" && reservation.status === "CONFIRMED") {
        return { isApplied: true, reservation, isIdempotentReplay: true };
      }

      if (reservation.status !== "PENDING_PAYMENT" && reservation.status !== "HELD") {
        return { isApplied: false, reason: "STATUS_CONFLICT" };
      }

      const updated: ReservationRecord = {
        ...reservation,
        status: "CONFIRMED",
        paymentRequestPublicId: input.paymentRequestPublicId,
        updatedAt: input.now,
      };
      this.reservations.set(input.reservationId, updated);
      this.payments.set(input.paymentRequestPublicId, {
        ...payment,
        status: "PAID",
        paidAt: input.paidAt,
      });

      return { isApplied: true, reservation: updated, isIdempotentReplay: false };
    });
  }

  // ---------------------------------------------------------------- snapshots

  /** Read-only view for assertions. Test helper only. */
  snapshotInventory(roomTypeId: string, dates: readonly StayDate[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const date of dates) {
      const cell = this.inventory.get(inventoryKey(roomTypeId, date));
      out[date] = cell ? this.sellable(cell, new Date(0)) : 0;
    }
    return out;
  }

  cloneReservation(reservationId: string): ReservationRecord | null {
    const record = this.reservations.get(reservationId);
    return record ? clone(record) : null;
  }
}

export type {
  ReservationCancellationPolicySnapshot,
  ReservationGuest,
  TomanAmount,
};
