-- Keep storefront branding independent from the PWA browser theme color.
ALTER TABLE "OrganizationBranding"
ADD COLUMN "storefrontPrimaryColor" TEXT;
