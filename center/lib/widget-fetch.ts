import { mintServiceToken } from "./jwt"
import { WidgetPayloadSchema, type WidgetPayload } from "./widget-schema"

/**
 * Fetches widget data from a module's internal API endpoint.
 *
 * Mints a short-lived service token (iss=lc-center, aud=moduleId) so the
 * receiving module can verify the caller is the Center.
 *
 * Returns null on any failure — callers must handle the unavailable state.
 * Next.js caches the response for `refreshSeconds` before revalidating.
 * The 3s timeout prevents a slow module from blocking the dashboard render.
 * Note: Next.js caches by URL only; the auth header is present on real fetches
 * but not part of the cache key. This is correct — the response is what's cached,
 * not the credential.
 */
export async function fetchWidgetData(
  moduleId: string,
  internalApi: string,
  endpoint: string,
  refreshSeconds: number
): Promise<WidgetPayload | null> {
  const base = internalApi.replace(/\/$/, "")
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const url = `${base}${path}`

  try {
    const token = await mintServiceToken("center", moduleId)
    const res = await fetch(url, {
      next: { revalidate: refreshSeconds },
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const raw: unknown = await res.json()
    const result = WidgetPayloadSchema.safeParse(raw)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
