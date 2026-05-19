interface HeaderLike { get(name: string): string | null }

export function getUserId(headers: HeaderLike): string {
  const fromHeader = headers.get("remote-email") ?? headers.get("remote-user")
  if (fromHeader) return fromHeader
  const fallback = process.env.PANTRY_DEFAULT_USER ?? ""
  if (process.env.NODE_ENV === "production") {
    console.warn("[pantry] user identity from env fallback — forward-auth not configured")
  }
  return fallback
}
