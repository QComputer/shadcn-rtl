import { CustomerSsoLogin } from "@/components/auth/customer-sso-login";

export default async function CustomerSsoPage({ searchParams }: { searchParams: Promise<{ target?: string; challenge?: string; organization?: string }> }) {
  const query = await searchParams;
  return <CustomerSsoLogin target={typeof query.target === "string" ? query.target : ""} challenge={typeof query.challenge === "string" ? query.challenge : ""} organization={typeof query.organization === "string" ? query.organization : ""} />;
}
