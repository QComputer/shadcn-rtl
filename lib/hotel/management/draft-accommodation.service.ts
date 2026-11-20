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
    return this.draftsDb.hotelDraftAccommodation.create({
      data: { ...scope, ...fields, beds: beds ?? Prisma.DbNull },
    });
  }

  async update(principal: HotelManagementPrincipal, scope: DraftScope, draftId: string, input: DraftAccommodationPatch) {
    await this.authorizeDraftProperty(principal, scope);
    const { version, beds, ...fields } = input;
    const draft = await this.getActiveDraft(scope, draftId, version);
    assertDraftAccommodationOccupancy({ ...draft, ...fields });
    return this.updateAtVersion(scope, draftId, version, {
      ...fields,
      beds: beds === null ? Prisma.DbNull : beds,
    });
  }

  async archive(principal: HotelManagementPrincipal, scope: DraftScope, draftId: string, version: number) {
    await this.authorizeDraftProperty(principal, scope);
    await this.getActiveDraft(scope, draftId, version);
    return this.updateAtVersion(scope, draftId, version, { archivedAt: new Date() });
  }

  private async updateAtVersion(
    scope: DraftScope,
    draftId: string,
    version: number,
    data: Prisma.HotelDraftAccommodationUpdateInput,
  ) {
    try {
      return await this.draftsDb.hotelDraftAccommodation.update({
        where: { ...scope, id: draftId, version, archivedAt: null },
        data: { ...data, version: { increment: 1 } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new HotelManagementConflictError("Draft version changed");
      }
      throw error;
    }
  }
}
