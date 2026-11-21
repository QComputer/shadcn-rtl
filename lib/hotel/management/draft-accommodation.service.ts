import { Prisma, type PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { prisma as defaultPrisma } from "@/lib/db-runtime";
import {
  assertDraftAccommodationOccupancy,
  type DraftAccommodationInput,
  type DraftAccommodationPatch,
} from "./draft-accommodation-contracts";
import {
  HotelManagementConflictError,
  type HotelManagementPrincipal,
  HotelManagementService,
} from "./hotel-management.service";

type DraftScope = { organizationId: string; propertyId: string };

export class DraftAccommodationService extends HotelManagementService {
  constructor(private readonly draftsDb: PrismaClient = defaultPrisma) {
    super(draftsDb);
  }

  private async authorizeDraftProperty(principal: HotelManagementPrincipal, scope: DraftScope) {
    await this.authorizeOperations(principal, scope);
    const property = await this.draftsDb.hotelProperty.findFirst({
      where: { id: scope.propertyId, organizationId: scope.organizationId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!property) throw new ApiError(404, "Property not found");
  }

  private async getActiveDraft(scope: DraftScope, draftId: string, version: number) {
    const draft = await this.draftsDb.hotelDraftAccommodation.findFirst({
      where: { ...scope, id: draftId, archivedAt: null },
    });
    if (!draft) throw new ApiError(404, "Draft accommodation not found");
    if (draft.version !== version) throw new HotelManagementConflictError("Draft version changed");
    return draft;
  }

  async list(principal: HotelManagementPrincipal, scope: DraftScope) {
    await this.authorizeDraftProperty(principal, scope);
    return this.draftsDb.hotelDraftAccommodation.findMany({
      where: { ...scope, archivedAt: null },
      orderBy: { temporaryCode: "asc" },
    });
  }

  async create(principal: HotelManagementPrincipal, scope: DraftScope, input: DraftAccommodationInput) {
    await this.authorizeDraftProperty(principal, scope);
    assertDraftAccommodationOccupancy(input);
    const { beds, ...fields } = input;
    return this.draftsDb.$transaction(async (tx) => {
      const draft = await tx.hotelDraftAccommodation.create({
        data: { ...scope, ...fields, beds: beds ?? Prisma.DbNull },
      });
      await tx.auditLog.create({ data: {
        action: "CREATE",
        entityType: "HotelDraftAccommodation",
        entityId: draft.id,
        userId: principal.userId,
        organizationId: scope.organizationId,
        description: "Created draft hotel accommodation",
        newValue: { propertyId: scope.propertyId, temporaryCode: draft.temporaryCode, category: draft.category, version: draft.version },
      } });
      return draft;
    });
  }

  async update(principal: HotelManagementPrincipal, scope: DraftScope, draftId: string, input: DraftAccommodationPatch) {
    await this.authorizeDraftProperty(principal, scope);
    const { version, beds, ...fields } = input;
    const draft = await this.getActiveDraft(scope, draftId, version);
    assertDraftAccommodationOccupancy({ ...draft, ...fields });
    const data = { ...fields, beds: beds === null ? Prisma.DbNull : beds };
    return this.draftsDb.$transaction(async (tx) => {
      const changed = await tx.hotelDraftAccommodation.update({
        where: { ...scope, id: draftId, version, archivedAt: null },
        data: { ...data, version: { increment: 1 } },
      }).catch((error: unknown) => this.rethrowVersionConflict(error));
      await tx.auditLog.create({ data: {
        action: "UPDATE",
        entityType: "HotelDraftAccommodation",
        entityId: draftId,
        userId: principal.userId,
        organizationId: scope.organizationId,
        description: "Updated draft hotel accommodation",
        previousValue: { propertyId: scope.propertyId, version },
        newValue: { propertyId: scope.propertyId, version: changed.version, changedFields: Object.keys(fields).concat(beds !== undefined ? ["beds"] : []) },
      } });
      return changed;
    });
  }

  async archive(principal: HotelManagementPrincipal, scope: DraftScope, draftId: string, version: number) {
    await this.authorizeDraftProperty(principal, scope);
    await this.getActiveDraft(scope, draftId, version);
    return this.draftsDb.$transaction(async (tx) => {
      const archived = await tx.hotelDraftAccommodation.update({
        where: { ...scope, id: draftId, version, archivedAt: null },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      }).catch((error: unknown) => this.rethrowVersionConflict(error));
      await tx.auditLog.create({ data: {
        action: "UPDATE",
        entityType: "HotelDraftAccommodation",
        entityId: draftId,
        userId: principal.userId,
        organizationId: scope.organizationId,
        description: "Archived draft hotel accommodation",
        previousValue: { propertyId: scope.propertyId, version },
        newValue: { propertyId: scope.propertyId, version: archived.version, archived: true },
      } });
      return archived;
    });
  }

  private rethrowVersionConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HotelManagementConflictError("Draft version changed");
    }
    throw error;
  }

  private async updateAtVersion(
    scope: DraftScope,
    draftId: string,
    version: number,
    data: Prisma.HotelDraftAccommodationUpdateInput,
  ) {
    return this.draftsDb.hotelDraftAccommodation.update({
      where: { ...scope, id: draftId, version, archivedAt: null },
      data: { ...data, version: { increment: 1 } },
    }).catch((error: unknown) => this.rethrowVersionConflict(error));
  }
}
