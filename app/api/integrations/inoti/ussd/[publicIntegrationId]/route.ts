import { inotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { inotiPlainTextResponse } from "@/lib/integrations/inoti-ussd/response";
import { recordInotiUssdIngress } from "@/lib/integrations/inoti-ussd/ingress";
import type { InotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function createInotiUssdCallbackHandler(
  workflow: InotiUssdWorkflow,
  recordIngress: typeof recordInotiUssdIngress = recordInotiUssdIngress,
) {
  return async function handler(
  request: Request,
  { params }: { params: Promise<{ publicIntegrationId: string }> },
  ) {
  const startedAtMs = Date.now();
  try {
    const { publicIntegrationId } = await params;
    const url = new URL(request.url);
    const requestHost = request.headers.get("host");
    await recordIngress(request, publicIntegrationId);
    return inotiPlainTextResponse(await workflow.handle(publicIntegrationId, requestHost, url.searchParams, {
      method: request.method,
      startedAtMs,
    }));
  } catch {
    return inotiPlainTextResponse("سرویس در دسترس نیست");
  }
  };
}

export const GET = createInotiUssdCallbackHandler(inotiUssdWorkflow);
