"use client";

import Link from "next/link";
import { useOrganizationRootNavigation } from "@/lib/contexts/organization-root-navigation-context";

export function OrganizationRootLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const navigation = useOrganizationRootNavigation();

  if (navigation.mode === "hard") {
    return <a href={navigation.href} className={className}>{children}</a>;
  }

  return <Link href={navigation.href} className={className}>{children}</Link>;
}
