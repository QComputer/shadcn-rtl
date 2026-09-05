-- ExtendOrganizationBrandingTenantAssets
ALTER TABLE "OrganizationBranding"
  ADD COLUMN "pwaMaskable192Url" TEXT,
  ADD COLUMN "pwaMaskable512Url" TEXT,
  ADD COLUMN "monochromeIconUrl" TEXT,
  ADD COLUMN "markUrl" TEXT,
  ADD COLUMN "logoInverseUrl" TEXT,
  ADD COLUMN "themeColor" TEXT,
  ADD COLUMN "backgroundColor" TEXT;
