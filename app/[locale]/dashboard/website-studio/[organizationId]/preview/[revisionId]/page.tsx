import { notFound } from "next/navigation";
import { requireAuthSession, ApiError } from "@/lib/api-guards";
import { RetailWebsiteService } from "@/lib/website-studio/retail.service";
import { RetailWebsitePreview } from "@/components/website-studio/retail-preview";
import { RetailManagedHero } from "@/components/retail/retail-managed-hero";
import { resolveRetailHero, retailHeroProducts } from "@/lib/website-studio/retail-hero.server";
import { prisma } from "@/lib/db";
import { RetailBrandScope } from "@/components/retail/retail-brand-scope";
export default async function RetailPreviewPage({ params }: { params: Promise<{ organizationId: string; revisionId: string }> }) {
  const { organizationId, revisionId } = await params;
  const { user } = await requireAuthSession();
  let data: Awaited<ReturnType<RetailWebsiteService["load"]>>;
  try {
    data = await new RetailWebsiteService().load({ userId: user.id, role: user.role, organizationId: user.organizationId }, organizationId, revisionId);
  } catch (error) { if (error instanceof ApiError && [403, 404].includes(error.status)) notFound(); throw error; }
  const hero = resolveRetailHero(data.content, data.media);
  const branding = await prisma.organizationBranding.findUnique({ where: { organizationId }, select: { storefrontPrimaryColor: true } });
  if (hero) return <RetailBrandScope color={branding?.storefrontPrimaryColor}><main dir="rtl" className="min-h-screen bg-background py-6 text-foreground"><RetailManagedHero hero={hero} products={await retailHeroProducts(data.organization.slug, hero.productIds)} name={data.organization.name} storefrontPath="/shop" preview /><p className="px-6 text-center text-sm text-muted-foreground">پیش‌نمایش خصوصی هیرو · پیوندها در پیش‌نمایش غیرفعال‌اند.</p></main></RetailBrandScope>;
  return <RetailBrandScope color={branding?.storefrontPrimaryColor}><RetailWebsitePreview content={data.content} media={data.media} organizationName={data.organization.name} /></RetailBrandScope>;
}
