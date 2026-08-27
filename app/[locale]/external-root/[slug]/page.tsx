import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

interface ExternalRootPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function ExternalRootPage({ params }: ExternalRootPageProps) {
  const { slug } = await params;

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!organization) {
    notFound();
  }

  notFound();
}
