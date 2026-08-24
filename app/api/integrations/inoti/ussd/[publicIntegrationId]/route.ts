import { inotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { inotiPlainTextResponse } from "@/lib/integrations/inoti-ussd/response";
import { recordInotiUssdIngress } from "@/lib/integrations/inoti-ussd/ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicIntegrationId: string }> },
) {
  const startedAtMs = Date.now();
  try {
    const { publicIntegrationId } = await params;
    const url = new URL(request.url);
    const requestHost = request.headers.get("host");
    await recordInotiUssdIngress(request, publicIntegrationId);
    return inotiPlainTextResponse(await inotiUssdWorkflow.handle(publicIntegrationId, requestHost, url.searchParams, {
      method: request.method,
      startedAtMs,
    }));
  } catch {
    return inotiPlainTextResponse("سرویس در دسترس نیست");
  }
}
