export function inotiPlainTextResponse(body: string) {
  return new Response(body.replace(/^[\r\n]+|[\r\n]+$/g, ""), {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-content-type-options": "nosniff",
    },
  });
}

