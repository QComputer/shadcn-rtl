import { ApiError } from "@/lib/api-guards";

export const DEMO_JSON_BODY_MAX_BYTES = 64 * 1024;

type ReadBoundedJsonOptions = {
  maxBytes?: number;
  emptyBody?: "reject" | "empty-object";
};

/** Read and parse a JSON body while enforcing a limit on the actual stream bytes. */
export async function readBoundedJson(
  request: Request,
  options: ReadBoundedJsonOptions = {},
): Promise<unknown> {
  const maxBytes = options.maxBytes ?? DEMO_JSON_BODY_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    throw new ApiError(413, "Request body is too large");
  }

  const malformed = (size: number) => {
    if (size === 0 && options.emptyBody === "empty-object") return {};
    throw new ApiError(400, "Invalid JSON body");
  };

  const reader = request.body?.getReader();
  if (!reader) return malformed(0);

  let size = 0;
  let text = "";
  let streamFinished = false;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { streamFinished = true; break; }
      size += value.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* The size limit still applies if cancellation fails. */ }
        throw new ApiError(413, "Request body is too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (!streamFinished) throw new ApiError(400, "Invalid JSON body");
    return malformed(size);
  } finally {
    reader.releaseLock();
  }
}
