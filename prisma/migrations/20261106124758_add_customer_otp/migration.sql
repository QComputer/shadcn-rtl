/*
  Warnings:

  - You are about to drop the column `applicationName` on the `OrganizationBranding` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `OrganizationBranding` table. All the data in the column will be lost.
  - You are about to drop the column `logoInverseUrl` on the `OrganizationBranding` table. All the data in the column will be lost.
  - You are about to drop the column `markUrl` on the `OrganizationBranding` table. All the data in the column will be lost.
  - You are about to drop the column `monochromeIconUrl` on the `OrganizationBranding` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_userId_fkey";

-- DropIndex
DROP INDEX "Organization_isPlatformOwner_idx";

-- DropIndex
DROP INDEX "ProductVariant_manuallyUnavailable_idx";

-- AlterTable
ALTER TABLE "CustomerAccessLink" ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpCodeHash" TEXT,
ADD COLUMN     "otpConsumedAt" TIMESTAMP(3),
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationBranding" DROP COLUMN "applicationName",
DROP COLUMN "deletedAt",
DROP COLUMN "logoInverseUrl",
DROP COLUMN "markUrl",
DROP COLUMN "monochromeIconUrl",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "HotelRatePlan" RENAME CONSTRAINT "HotelRatePlan_cancellationPolicyId_propertyId_organizationId_fk" TO "HotelRatePlan_cancellationPolicyId_propertyId_organization_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteContentReview" RENAME CONSTRAINT "HotelWebsiteContentReview_page_scope_fkey" TO "HotelWebsiteContentReview_pageId_organizationId_propertyId_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteContentReview" RENAME CONSTRAINT "HotelWebsiteContentReview_revision_scope_fkey" TO "HotelWebsiteContentReview_revisionId_organizationId_proper_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteContentRevision" RENAME CONSTRAINT "HotelWebsiteContentRevision_page_scope_fkey" TO "HotelWebsiteContentRevision_pageId_organizationId_property_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteMediaAssociation" RENAME CONSTRAINT "HotelWebsiteMediaAssociation_image_owner_fkey" TO "HotelWebsiteMediaAssociation_imageId_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteMediaAssociation" RENAME CONSTRAINT "HotelWebsiteMediaAssociation_page_scope_fkey" TO "HotelWebsiteMediaAssociation_pageId_organizationId_propert_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteMediaAssociation" RENAME CONSTRAINT "HotelWebsiteMediaAssociation_property_scope_fkey" TO "HotelWebsiteMediaAssociation_propertyId_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteMediaAssociation" RENAME CONSTRAINT "HotelWebsiteMediaAssociation_revision_scope_fkey" TO "HotelWebsiteMediaAssociation_revisionId_organizationId_pro_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteMediaAssociation" RENAME CONSTRAINT "HotelWebsiteMediaAssociation_room_scope_fkey" TO "HotelWebsiteMediaAssociation_roomTypeId_propertyId_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsiteOperation" RENAME CONSTRAINT "HotelWebsiteOperation_property_scope_fkey" TO "HotelWebsiteOperation_propertyId_organizationId_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsitePublication" RENAME CONSTRAINT "HotelWebsitePublication_page_scope_fkey" TO "HotelWebsitePublication_pageId_organizationId_propertyId_fkey";

-- RenameForeignKey
ALTER TABLE "HotelWebsitePublication" RENAME CONSTRAINT "HotelWebsitePublication_revision_scope_fkey" TO "HotelWebsitePublication_revisionId_organizationId_property_fkey";

-- RenameForeignKey
ALTER TABLE "OrganizationIntegrationCapability" RENAME CONSTRAINT "OrganizationIntegrationCapability_integrationId_organizationId_" TO "OrganizationIntegrationCapability_integrationId_organizati_fkey";

-- RenameForeignKey
ALTER TABLE "PaymentProviderAttempt" RENAME CONSTRAINT "PaymentProviderAttempt_providerIntegrationId_organizationId_fke" TO "PaymentProviderAttempt_providerIntegrationId_organizationI_fkey";

-- RenameForeignKey
ALTER TABLE "UssdPaymentVerificationJob" RENAME CONSTRAINT "UssdPaymentVerificationJob_paymentIntentId_integrationId_organi" TO "UssdPaymentVerificationJob_paymentIntentId_integrationId_o_fkey";

-- RenameForeignKey
ALTER TABLE "UssdPaymentVerificationJob" RENAME CONSTRAINT "UssdPaymentVerificationJob_providerAttemptId_organizationId_fke" TO "UssdPaymentVerificationJob_providerAttemptId_organizationI_fkey";

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "BusinessEntityRelation_organizationId_sourceEntityId_targetEnti" RENAME TO "BusinessEntityRelation_organizationId_sourceEntityId_target_key";

-- RenameIndex
ALTER INDEX "CouponRedemption_organizationId_customerId_couponId_releasedAt_" RENAME TO "CouponRedemption_organizationId_customerId_couponId_release_idx";

-- RenameIndex
ALTER INDEX "CustomerInteraction_organizationId_customerIdentityId_occurredA" RENAME TO "CustomerInteraction_organizationId_customerIdentityId_occur_idx";

-- RenameIndex
ALTER INDEX "ExternalCatalogConnection_organizationId_provider_externalUrl_k" RENAME TO "ExternalCatalogConnection_organizationId_provider_externalU_key";

-- RenameIndex
ALTER INDEX "ExternalEntityMapping_organizationId_externalSource_externalEnt" RENAME TO "ExternalEntityMapping_organizationId_externalSource_externa_key";

-- RenameIndex
ALTER INDEX "GrowthRecommendation_organizationId_recommendationType_title_ke" RENAME TO "GrowthRecommendation_organizationId_recommendationType_titl_key";

-- RenameIndex
ALTER INDEX "HotelBookingHoldIdempotency_scope_created_idx" RENAME TO "HotelBookingHoldIdempotency_organizationId_operationScope_c_idx";

-- RenameIndex
ALTER INDEX "HotelBookingHoldIdempotency_scope_key" RENAME TO "HotelBookingHoldIdempotency_organizationId_operationScope_i_key";

-- RenameIndex
ALTER INDEX "HotelInventoryIdempotency_organizationId_operationScope_created" RENAME TO "HotelInventoryIdempotency_organizationId_operationScope_cre_idx";

-- RenameIndex
ALTER INDEX "HotelInventoryIdempotency_organizationId_operationScope_idempot" RENAME TO "HotelInventoryIdempotency_organizationId_operationScope_ide_key";

-- RenameIndex
ALTER INDEX "HotelPublicationApproval_scope_revision_key" RENAME TO "HotelPublicationApproval_organizationId_propertyId_resource_key";

-- RenameIndex
ALTER INDEX "HotelPublicationApproval_scope_status_idx" RENAME TO "HotelPublicationApproval_organizationId_propertyId_resource_idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteContentReview_revision_action_createdAt_idx" RENAME TO "HotelWebsiteContentReview_revisionId_action_createdAt_idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteContentReview_scope_createdAt_idx" RENAME TO "HotelWebsiteContentReview_organizationId_propertyId_pageId__idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteContentRevision_scope_createdAt_idx" RENAME TO "HotelWebsiteContentRevision_organizationId_propertyId_pageI_idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteMediaAssociation_image_owner_idx" RENAME TO "HotelWebsiteMediaAssociation_imageId_organizationId_idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteMediaAssociation_scope_order_idx" RENAME TO "HotelWebsiteMediaAssociation_organizationId_propertyId_revi_idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteOperation_scope_createdAt_idx" RENAME TO "HotelWebsiteOperation_organizationId_propertyId_createdAt_idx";

-- RenameIndex
ALTER INDEX "HotelWebsiteOperation_scope_operation_key_key" RENAME TO "HotelWebsiteOperation_organizationId_propertyId_operation_i_key";

-- RenameIndex
ALTER INDEX "HotelWebsitePublication_revision_idx" RENAME TO "HotelWebsitePublication_organizationId_propertyId_revisionI_idx";

-- RenameIndex
ALTER INDEX "HotelWebsitePublication_scope_publishedAt_idx" RENAME TO "HotelWebsitePublication_organizationId_propertyId_pageId_pu_idx";

-- RenameIndex
ALTER INDEX "Order_retailCheckoutKey_retailPaymentDeadlineAt_paymentStatus_s" RENAME TO "Order_retailCheckoutKey_retailPaymentDeadlineAt_paymentStat_idx";

-- RenameIndex
ALTER INDEX "OrganizationIntegrationCapability_integrationId_capabilityKey_k" RENAME TO "OrganizationIntegrationCapability_integrationId_capabilityK_key";

-- RenameIndex
ALTER INDEX "OrganizationIntegrationCapability_organizationId_capabilityKey_" RENAME TO "OrganizationIntegrationCapability_organizationId_capability_idx";

-- RenameIndex
ALTER INDEX "PaymentProviderAttempt_providerIntegrationId_merchantFactorId_k" RENAME TO "PaymentProviderAttempt_providerIntegrationId_merchantFactor_key";

-- RenameIndex
ALTER INDEX "PaymentProviderAttempt_providerIntegrationId_providerFactorId_k" RENAME TO "PaymentProviderAttempt_providerIntegrationId_providerFactor_key";

-- RenameIndex
ALTER INDEX "RetailAttributeDefinition_organizationId_scope_isActive_sortOrd" RENAME TO "RetailAttributeDefinition_organizationId_scope_isActive_sor_idx";

-- RenameIndex
ALTER INDEX "ReviewRequest_organizationId_businessEventId_customerIdentityId" RENAME TO "ReviewRequest_organizationId_businessEventId_customerIdenti_key";

-- RenameIndex
ALTER INDEX "UssdPaymentVerificationJob_integrationId_status_nextAttemptAt_i" RENAME TO "UssdPaymentVerificationJob_integrationId_status_nextAttempt_idx";

-- RenameIndex
ALTER INDEX "UssdPaymentVerificationJob_paymentIntentId_integrationId_organi" RENAME TO "UssdPaymentVerificationJob_paymentIntentId_integrationId_or_key";
