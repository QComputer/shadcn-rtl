import { writeAuditLog } from "@/lib/audit-log";
import { diagnosticCall, safeParameterNames } from "@/lib/integrations/inoti-ussd/request-diagnostics";

type AuditWriter = (input: Parameters<typeof writeAuditLog>[0]) => Promise<void>;

function safeAscii(value: string | null, maxLength: number) {
  if (!value || /[^\x20-\x7e]/.test(value)) return null;
  return value.slice(0, maxLength);
}

export function buildInotiUssdIngressAudit(request: Request, publicIntegrationId: string) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const parameterNames = safeParameterNames(searchParams);
  return {
    action: "CREATE" as const,
    entityType: "InotiUssdIngress",
    entityId: safeAscii(publicIntegrationId, 128) ?? "unknown",
    description: "USSD_INGRESS_RECEIVED",
    newValue: {
      event: "USSD_INGRESS_RECEIVED",
      requestMethod: request.method.slice(0, 16),
      requestHost: safeAscii(request.headers.get("host") ?? url.host, 255),
      requestPath: safeAscii(url.pathname, 512),
      parameterNames,
      parameterNameCount: parameterNames.length,
      ...diagnosticCall(searchParams),
      callValueCount: searchParams.getAll("call").length,
      mobilePresent: searchParams.has("mobile"),
      mobileValueCount: searchParams.getAll("mobile").length,
      sessionidPresent: searchParams.has("sessionid"),
      sessionidValueCount: searchParams.getAll("sessionid").length,
      rrnPresent: searchParams.has("RRN") || searchParams.has("rrn"),
      rrnValueCount: searchParams.getAll("RRN").length + searchParams.getAll("rrn").length,
      deploymentCommit: safeAscii(process.env.VERCEL_GIT_COMMIT_SHA ?? null, 64),
    },
  };
}

export async function recordInotiUssdIngress(
  request: Request,
  publicIntegrationId: string,
  writer: AuditWriter = writeAuditLog,
) {
  await writer(buildInotiUssdIngressAudit(request, publicIntegrationId));
}
