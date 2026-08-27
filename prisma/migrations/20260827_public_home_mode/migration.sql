-- AddPublicHomeModeAndBrandLandingProvider
CREATE TYPE "PublicHomeMode" AS ENUM ('AUTO', 'SHOP', 'APPOINTMENT', 'BRAND', 'VISITOR_CHOICE');
CREATE TYPE "BrandLandingProvider" AS ENUM ('BAZARBAAZ', 'CUSTOM_INTERNAL', 'CUSTOM_EXTERNAL');

-- AddColumn
ALTER TABLE "OrganizationSettings" ADD COLUMN "publicHomeMode" "PublicHomeMode";
ALTER TABLE "OrganizationSettings" ADD COLUMN "brandLandingProvider" "BrandLandingProvider";
