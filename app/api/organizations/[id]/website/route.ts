import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { RetailWebsiteService } from "@/lib/website-studio/retail.service";

const service = new RetailWebsiteService();
const headers = { "Cache-Control": "private, no-store, max-age=0" };
type Context = { params: Promise<{ id: string }> };
async function boundedBody(request: Request) {
  const limit = 200_000;
  if (Number(request.headers.get("content-length")) > limit) throw new ApiError(413, "حجم محتوا بیش از حد مجاز است.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "درخواست JSON معتبر لازم است.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ApiError(413, "حجم محتوا بیش از حد مجاز است."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
function failure(error: unknown) {
  const response = error instanceof ZodError
    ? NextResponse.json({ error: error.issues[0]?.message ?? "محتوا معتبر نیست." }, { status: 422 })
    : jsonError(error, "ذخیره یا بارگذاری وب‌سایت ممکن نشد.");
  response.headers.set("Cache-Control", headers["Cache-Control"]);
  return response;
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const session = await requireAuthSession();
    return NextResponse.json(await service.load({ userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId }, (await params).id), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: Context) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    // Bound body before parsing; website drafts do not accept binary uploads.
    const text = await boundedBody(request);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new ApiError(400, "درخواست JSON معتبر لازم است."); }
    return NextResponse.json(await service.save({ userId: session.user.id, role: session.user.role, organizationId: session.user.organizationId }, (await params).id, body), { status: 201, headers });
  } catch (error) { return failure(error); }
}
