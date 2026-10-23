import {NextResponse} from "next/server";
import {jsonError} from "@/lib/api-guards";
import {requireRetailMerchantContext,assertRetailMutationOrigin} from "@/lib/retail/merchant-context.server";
import {previewRetailImport} from "@/lib/import-hub/retail-catalog.server";
import {readImportBody} from "@/lib/import-hub/retail-request.server";
export const maxDuration=60;
export async function POST(request:Request){try{assertRetailMutationOrigin(request);const {context}=await requireRetailMerchantContext();const body=await readImportBody(request);return NextResponse.json(await previewRetailImport(context,body),{headers:{"Cache-Control":"private, no-store"}});}catch(e){return jsonError(e,"ورود گروهی انجام نشد؛ فایل و پیش‌نمایش را بررسی کنید.");}}
