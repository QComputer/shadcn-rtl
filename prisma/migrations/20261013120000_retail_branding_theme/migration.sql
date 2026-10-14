ALTER TABLE "OrganizationBranding"
  ADD COLUMN "retailPresentationTheme" TEXT,
  ADD COLUMN "retailPreviewOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrganizationBranding"
  ADD CONSTRAINT "OrganizationBranding_retailPresentationTheme_check"
  CHECK ("retailPresentationTheme" IS NULL OR "retailPresentationTheme" IN ('FASHION', 'ELECTRONICS', 'GENERAL'));
