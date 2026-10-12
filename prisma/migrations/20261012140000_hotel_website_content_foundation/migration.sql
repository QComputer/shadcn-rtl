CREATE TYPE "HotelWebsiteRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "HotelWebsiteMediaScope" AS ENUM ('PROPERTY', 'ROOM_CATEGORY');
CREATE TYPE "HotelWebsiteReviewAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- No active website grant can be inserted by relying on the table default.
-- The audited capability endpoint must set enabledAt when it explicitly enables it.
ALTER TABLE "OrganizationCapability"
  ADD CONSTRAINT "OrganizationCapability_hotel_website_explicit_enable_check"
  CHECK ("key" <> 'HOTEL_WEBSITE'::"OrganizationCapabilityKey"
    OR "status" <> 'ACTIVE'::"OrganizationCapabilityStatus"
    OR "enabledAt" IS NOT NULL);

CREATE UNIQUE INDEX "Image_id_organizationId_key" ON "Image"("id", "organizationId");

CREATE TABLE "HotelWebsitePage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL DEFAULT 'HOME',
    "revisionCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelWebsitePage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HotelWebsitePage_revisionCounter_check" CHECK ("revisionCounter" >= 0),
    CONSTRAINT "HotelWebsitePage_id_organizationId_propertyId_key" UNIQUE ("id", "organizationId", "propertyId"),
    CONSTRAINT "HotelWebsitePage_organizationId_propertyId_pageKey_key" UNIQUE ("organizationId", "propertyId", "pageKey"),
    CONSTRAINT "HotelWebsitePage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsitePage_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelWebsitePage_organizationId_propertyId_idx" ON "HotelWebsitePage"("organizationId", "propertyId");

CREATE TABLE "HotelWebsiteContentRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "HotelWebsiteRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "contentSha256" CHAR(64) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelWebsiteContentRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HotelWebsiteContentRevision_revisionNumber_check" CHECK ("revisionNumber" > 0),
    CONSTRAINT "HotelWebsiteContentRevision_contentSha256_check" CHECK ("contentSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "HotelWebsiteContentRevision_id_organizationId_propertyId_key" UNIQUE ("id", "organizationId", "propertyId"),
    CONSTRAINT "HotelWebsiteContentRevision_pageId_revisionNumber_key" UNIQUE ("pageId", "revisionNumber"),
    CONSTRAINT "HotelWebsiteContentRevision_page_scope_fkey" FOREIGN KEY ("pageId", "organizationId", "propertyId") REFERENCES "HotelWebsitePage"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteContentRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HotelWebsiteContentRevision_scope_createdAt_idx" ON "HotelWebsiteContentRevision"("organizationId", "propertyId", "pageId", "createdAt");

CREATE FUNCTION "hotel_website_revision_snapshot_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
     OR NEW."pageId" IS DISTINCT FROM OLD."pageId"
     OR NEW."revisionNumber" IS DISTINCT FROM OLD."revisionNumber"
     OR NEW."content" IS DISTINCT FROM OLD."content"
     OR NEW."contentSha256" IS DISTINCT FROM OLD."contentSha256"
     OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Hotel website revision snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HotelWebsiteContentRevision_snapshot_immutable"
BEFORE UPDATE ON "HotelWebsiteContentRevision"
FOR EACH ROW EXECUTE FUNCTION "hotel_website_revision_snapshot_immutable"();

CREATE TABLE "HotelWebsiteMediaAssociation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "scope" "HotelWebsiteMediaScope" NOT NULL,
    "roomTypeId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "slot" TEXT NOT NULL DEFAULT 'GALLERY',
    "altText" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelWebsiteMediaAssociation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HotelWebsiteMediaAssociation_sortOrder_check" CHECK ("sortOrder" >= 0),
    CONSTRAINT "HotelWebsiteMediaAssociation_scope_target_check" CHECK (("scope" = 'PROPERTY' AND "roomTypeId" IS NULL) OR ("scope" = 'ROOM_CATEGORY' AND "roomTypeId" IS NOT NULL)),
    CONSTRAINT "HotelWebsiteMediaAssociation_page_scope_fkey" FOREIGN KEY ("pageId", "organizationId", "propertyId") REFERENCES "HotelWebsitePage"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteMediaAssociation_revision_scope_fkey" FOREIGN KEY ("revisionId", "organizationId", "propertyId") REFERENCES "HotelWebsiteContentRevision"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteMediaAssociation_image_owner_fkey" FOREIGN KEY ("imageId", "organizationId") REFERENCES "Image"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteMediaAssociation_property_scope_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteMediaAssociation_room_scope_fkey" FOREIGN KEY ("roomTypeId", "propertyId") REFERENCES "HotelRoomType"("id", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelWebsiteMediaAssociation_scope_order_idx" ON "HotelWebsiteMediaAssociation"("organizationId", "propertyId", "revisionId", "scope", "roomTypeId", "sortOrder");
CREATE INDEX "HotelWebsiteMediaAssociation_image_owner_idx" ON "HotelWebsiteMediaAssociation"("imageId", "organizationId");
CREATE UNIQUE INDEX "HotelWebsiteMediaAssociation_property_order_key" ON "HotelWebsiteMediaAssociation"("revisionId", "slot", "sortOrder") WHERE "roomTypeId" IS NULL;
CREATE UNIQUE INDEX "HotelWebsiteMediaAssociation_room_order_key" ON "HotelWebsiteMediaAssociation"("revisionId", "roomTypeId", "slot", "sortOrder") WHERE "roomTypeId" IS NOT NULL;

CREATE TABLE "HotelWebsitePublication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    CONSTRAINT "HotelWebsitePublication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HotelWebsitePublication_page_scope_fkey" FOREIGN KEY ("pageId", "organizationId", "propertyId") REFERENCES "HotelWebsitePage"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsitePublication_revision_scope_fkey" FOREIGN KEY ("revisionId", "organizationId", "propertyId") REFERENCES "HotelWebsiteContentRevision"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsitePublication_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsitePublication_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelWebsitePublication_one_active_per_page" ON "HotelWebsitePublication"("organizationId", "propertyId", "pageId") WHERE "revokedAt" IS NULL;
CREATE INDEX "HotelWebsitePublication_scope_publishedAt_idx" ON "HotelWebsitePublication"("organizationId", "propertyId", "pageId", "publishedAt");
CREATE INDEX "HotelWebsitePublication_revision_idx" ON "HotelWebsitePublication"("organizationId", "propertyId", "revisionId");
ALTER TABLE "HotelWebsitePublication"
  ADD CONSTRAINT "HotelWebsitePublication_revocation_actor_check"
  CHECK (("revokedAt" IS NULL) = ("revokedByUserId" IS NULL));

CREATE FUNCTION "hotel_website_publication_requires_approved_revision"() RETURNS TRIGGER AS $$
DECLARE revision_status "HotelWebsiteRevisionStatus";
BEGIN
  SELECT "status" INTO revision_status
  FROM "HotelWebsiteContentRevision"
  WHERE "id" = NEW."revisionId"
    AND "organizationId" = NEW."organizationId"
    AND "propertyId" = NEW."propertyId"
    AND "pageId" = NEW."pageId";
  IF revision_status IS DISTINCT FROM 'APPROVED'::"HotelWebsiteRevisionStatus" THEN
    RAISE EXCEPTION 'Hotel website publication must reference an approved revision';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HotelWebsitePublication_approved_revision"
BEFORE INSERT ON "HotelWebsitePublication"
FOR EACH ROW EXECUTE FUNCTION "hotel_website_publication_requires_approved_revision"();

CREATE FUNCTION "hotel_website_published_revision_status_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" IS DISTINCT FROM OLD."status"
     AND EXISTS (SELECT 1 FROM "HotelWebsitePublication" WHERE "revisionId" = OLD."id") THEN
    RAISE EXCEPTION 'A published Hotel website revision cannot change review status';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HotelWebsiteContentRevision_published_status_immutable"
BEFORE UPDATE ON "HotelWebsiteContentRevision"
FOR EACH ROW EXECUTE FUNCTION "hotel_website_published_revision_status_immutable"();

CREATE FUNCTION "hotel_website_media_association_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Hotel website revision media associations are immutable; create a new revision';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HotelWebsiteMediaAssociation_immutable"
BEFORE UPDATE OR DELETE ON "HotelWebsiteMediaAssociation"
FOR EACH ROW EXECUTE FUNCTION "hotel_website_media_association_immutable"();

CREATE FUNCTION "hotel_website_publication_identity_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."propertyId" IS DISTINCT FROM OLD."propertyId"
     OR NEW."pageId" IS DISTINCT FROM OLD."pageId"
     OR NEW."revisionId" IS DISTINCT FROM OLD."revisionId"
     OR NEW."publishedByUserId" IS DISTINCT FROM OLD."publishedByUserId"
     OR NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
     OR OLD."revokedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Hotel website publication identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "HotelWebsitePublication_identity_immutable"
BEFORE UPDATE ON "HotelWebsitePublication"
FOR EACH ROW EXECUTE FUNCTION "hotel_website_publication_identity_immutable"();

CREATE TABLE "HotelWebsiteContentReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "HotelWebsiteReviewAction" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelWebsiteContentReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HotelWebsiteContentReview_page_scope_fkey" FOREIGN KEY ("pageId", "organizationId", "propertyId") REFERENCES "HotelWebsitePage"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteContentReview_revision_scope_fkey" FOREIGN KEY ("revisionId", "organizationId", "propertyId") REFERENCES "HotelWebsiteContentRevision"("id", "organizationId", "propertyId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelWebsiteContentReview_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HotelWebsiteContentReview_scope_createdAt_idx" ON "HotelWebsiteContentReview"("organizationId", "propertyId", "pageId", "createdAt");
CREATE INDEX "HotelWebsiteContentReview_revision_action_createdAt_idx" ON "HotelWebsiteContentReview"("revisionId", "action", "createdAt");
