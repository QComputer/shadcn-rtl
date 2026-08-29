import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolveOperationalProductHandoff } from "@/lib/purchase-intent.server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PurchaseProductHandoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string; productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug, productId } = await params;
  let target: string;
  try {
    target = await resolveOperationalProductHandoff({
      organizationIdentifier: slug,
      productId,
      locale,
      query: await searchParams,
    });
  } catch {
    notFound();
  }
  redirect(target);
}
