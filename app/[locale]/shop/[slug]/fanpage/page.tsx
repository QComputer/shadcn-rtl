import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquareText, Rss } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { FanpagePostCard } from "@/components/follow/fanpage-post-card";
import { FanpagePostForm } from "@/components/follow/fanpage-post-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JsonLd } from "@/components/seo/json-ld";
import { buildPublicMetadata, getCanonicalUrl, truncateSeoText } from "@/lib/seo";
import type { Metadata } from "next";

interface FanpagePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

async function canManageFanpage(userId: string | undefined, userRole: string | undefined, organizationId: string) {
  if (!userId || !userRole) return false;
  if (userRole === "SUPER_ADMIN") return true;

  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
      role: { in: ["ADMIN", "MANAGER"] },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

export async function generateMetadata({ params }: FanpagePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const organization = await prisma.organization.findFirst({
    where: { slug, type: "SHOP", isActive: true, deletedAt: null },
    select: { name: true, slug: true, description: true, logo: true, coverImage: true },
  });

  if (!organization) {
    return { title: "Fanpage Not Found" };
  }

  return buildPublicMetadata({
    locale,
    path: `/${locale}/shop/${organization.slug}/fanpage`,
    title: `${organization.name} fanpage`,
    description: organization.description || `Latest updates from ${organization.name}.`,
    image: organization.coverImage || organization.logo,
    type: "article",
    keywords: ["Bazar Baz", "fanpage", "shop", organization.slug],
    alternatePath: (nextLocale) => `/${nextLocale}/shop/${organization.slug}/fanpage`,
  });
}

export default async function ShopFanpagePage({ params }: FanpagePageProps) {
  const { locale, slug } = await params;
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);
  const session = await auth();

  const organization = await prisma.organization.findFirst({
    where: { slug, type: "SHOP", isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  });

  if (!organization) {
    notFound();
  }

  const [posts, userCanManage] = await Promise.all([
    prisma.fanpagePost.findMany({
      where: {
        organizationId: organization.id,
        isPublished: true,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        body: true,
        image: true,
        video: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            avatar: true,
            image: true,
          },
        },
      },
    }),
    canManageFanpage(session?.user?.id, session?.user?.role, organization.id),
  ]);

  return (
    <div className="min-h-screen bg-muted/20">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${getCanonicalUrl(`/${locale}/shop/${organization.slug}/fanpage`)}#fanpage`,
          name: `${organization.name} fanpage`,
          description: truncateSeoText(organization.description, `Latest updates from ${organization.name}.`),
          url: getCanonicalUrl(`/${locale}/shop/${organization.slug}/fanpage`),
        }}
      />
      <section className="border-b bg-background">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                <Rss className="h-4 w-4" />
                {t("fanpage.badge")}
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">{t("fanpage.title")}</h1>
              <p className="mt-3 text-muted-foreground">
                {t("fanpage.subtitle").replace("{organization}", organization.name)}
              </p>
            </div>
            <Button variant="outline">
              <Link href={`/${locale}/shop/${organization.slug}`}>{t("navigation.products")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <MessageSquareText className="h-10 w-10" />
                <p className="font-medium text-foreground">{t("fanpage.emptyTitle")}</p>
                <p>{t("fanpage.emptyDescription")}</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => <FanpagePostCard key={post.id} post={post} locale={locale} />)
          )}
        </main>

        <aside className="space-y-4">
          {userCanManage ? (
            <FanpagePostForm slug={organization.slug} locale={locale} />
          ) : (
            <Card>
              <CardContent className="space-y-3 py-6 text-sm text-muted-foreground">
                <p>{t("fanpage.followHint")}</p>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
