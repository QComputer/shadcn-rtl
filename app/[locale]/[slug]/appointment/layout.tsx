import type { ReactNode } from "react";
import { AppointmentLayoutContent, generateMetadata } from "./appointment-layout-content";

export { generateMetadata };

type AppointmentLayoutRouteProps = {
  children: ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export default function AppointmentLayout(props: AppointmentLayoutRouteProps) {
  return <AppointmentLayoutContent {...props} />;
}
