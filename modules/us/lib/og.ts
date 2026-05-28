export type OGResult = {
  title: string | null
  description: string | null
  imageUrl: string | null
  price: string | null
  currency: string | null
  extraImages: string[]
}

function getMeta(doc: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, "i"),
  ]
  for (const re of patterns) {
    const m = doc.match(re)
    if (m?.[1]) return m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'")
  }
  return null
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1])
      const items: unknown[] = Array.isArray(obj) ? obj : [obj]
      for (const item of items) {
        if (item && typeof item === "object" && (item as Record<string, unknown>)["@type"] === "Product") {
          return item as Record<string, unknown>
        }
      }
    } catch { /* ignore */ }
  }
  return null
}

function extractImages(product: Record<string, unknown>): string[] {
  const raw = product.image
  const candidates: string[] = []
  if (typeof raw === "string") candidates.push(raw)
  else if (Array.isArray(raw)) raw.forEach((x) => typeof x === "string" && candidates.push(x))
  return candidates.slice(0, 4)
}

function extractOffer(product: Record<string, unknown>): { price: string | null; currency: string | null } {
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers
  if (!offer || typeof offer !== "object") return { price: null, currency: null }
  const o = offer as Record<string, unknown>
  const price = o.price != null ? String(o.price)
    : o.lowPrice != null ? String(o.lowPrice)
    : o.highPrice != null ? String(o.highPrice)
    : null
  return {
    price,
    currency: typeof o.priceCurrency === "string" ? o.priceCurrency : null,
  }
}

export async function scrapeOG(inputUrl: string): Promise<OGResult> {
  const empty: OGResult = { title: null, description: null, imageUrl: null, price: null, currency: null, extraImages: [] }
  try {
    // AliExpress ignores Accept-Language and uses IP geolocation.
    // Force English via their locale cookie and language URL param.
    let url = inputUrl
    const extraHeaders: Record<string, string> = {}
    if (inputUrl.includes("aliexpress.com")) {
      const u = new URL(inputUrl)
      u.searchParams.set("language", "en_US")
      url = u.toString()
      extraHeaders["Cookie"] = "intl_locale=en_US; aep_usuc_f=site=glo&c_tp=USD&ups_d=update_date%3D2024-01-01; xman_us_f=x_locale=en_US"
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...extraHeaders,
      },
    })
    if (!res.ok) return empty
    const html = await res.text()

    const title = getMeta(html, "og:title") ?? getMeta(html, "twitter:title")
      ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null
    const description = getMeta(html, "og:description") ?? getMeta(html, "twitter:description") ?? null
    const imageUrl = getMeta(html, "og:image") ?? getMeta(html, "twitter:image") ?? null

    // Price from meta tags (Shopify, FB catalogs, etc.)
    const metaPrice = getMeta(html, "product:price:amount") ?? getMeta(html, "og:price:amount")
    const metaCurrency = getMeta(html, "product:price:currency") ?? getMeta(html, "og:price:currency")

    // JSON-LD Product schema (AliExpress, Temu, Amazon, etc.)
    const product = extractJsonLd(html)
    const ldImages = product ? extractImages(product) : []
    const { price: ldPrice, currency: ldCurrency } = product ? extractOffer(product) : { price: null, currency: null }

    const price = ldPrice ?? metaPrice ?? null
    const currency = ldCurrency ?? metaCurrency ?? null
    const extraImages = ldImages.filter((img) => img !== imageUrl)

    return { title, description, imageUrl, price, currency, extraImages }
  } catch {
    return empty
  }
}
