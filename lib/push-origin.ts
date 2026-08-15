export function normalizePushOrigin(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error("Push origin is invalid")
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Push origin is invalid")
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("Push origin must not contain a path")
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error("Push origin must use HTTPS")
  }

  return parsed.origin.toLowerCase()
}
