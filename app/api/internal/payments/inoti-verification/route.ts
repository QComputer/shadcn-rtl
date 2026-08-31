import { processDuePaymentVerifications } from "@/lib/integrations/inoti-ussd/durable-verification";
import { createDurablePaymentVerificationCronHandler } from "@/lib/integrations/inoti-ussd/durable-verification-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handleCronInvocation = createDurablePaymentVerificationCronHandler({ processDuePaymentVerifications });

export const GET = handleCronInvocation;
export const POST = handleCronInvocation;
