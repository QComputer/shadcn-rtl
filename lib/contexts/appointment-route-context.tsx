"use client";

import React, { createContext, useContext } from "react";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

type AppointmentRouteContextValue = {
  href: (subPath?: string) => string;
  organizationRootHref: string;
  isCustomDomain: boolean;
};

type AppointmentRouteProviderValue = {
  baseHref: string;
  organizationRootHref: string;
  isCustomDomain: boolean;
};

const AppointmentRouteContext = createContext<AppointmentRouteContextValue | null>(null);

export function buildAppointmentPublicPath(input: {
  locale: string;
  organizationSlug: string;
  subPath?: string;
  isCustomDomain?: boolean;
}) {
  return buildOrganizationPublicPath({
    locale: input.locale,
    organizationSlug: input.organizationSlug,
    surface: "appointment",
    subPath: input.subPath || "/",
    isCustomDomain: input.isCustomDomain,
  });
}

export function AppointmentRouteProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppointmentRouteProviderValue;
}) {
  const resolvedValue = React.useMemo<AppointmentRouteContextValue>(
    () => ({
      href: (subPath = "/") => {
        if (!subPath || subPath === "/") return value.baseHref;
        return `${value.baseHref}${subPath.startsWith("/") ? subPath : `/${subPath}`}`;
      },
      organizationRootHref: value.organizationRootHref,
      isCustomDomain: value.isCustomDomain,
    }),
    [value.baseHref, value.isCustomDomain, value.organizationRootHref],
  );

  return (
    <AppointmentRouteContext.Provider value={resolvedValue}>
      {children}
    </AppointmentRouteContext.Provider>
  );
}

export function useAppointmentRoutePaths(fallback: AppointmentRouteContextValue) {
  return useContext(AppointmentRouteContext) ?? fallback;
}
