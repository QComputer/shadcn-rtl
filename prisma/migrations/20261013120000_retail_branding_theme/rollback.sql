ALTER TABLE "OrganizationBranding"
  DROP CONSTRAINT "OrganizationBranding_retailPresentationTheme_check";
ALTER TABLE "OrganizationBranding"
  DROP COLUMN "retailPresentationTheme",
  DROP COLUMN "retailPreviewOnly";
