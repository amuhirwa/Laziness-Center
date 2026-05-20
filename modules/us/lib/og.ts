import ogs from "open-graph-scraper"

export type OGResult = {
  title: string | null
  description: string | null
  imageUrl: string | null
}

export async function scrapeOG(url: string): Promise<OGResult> {
  try {
    const { result } = await ogs({ url, timeout: 3000 })
    return {
      title: result.ogTitle ?? result.dcTitle ?? null,
      description: result.ogDescription ?? null,
      imageUrl: result.ogImage?.[0]?.url ?? null,
    }
  } catch {
    return { title: null, description: null, imageUrl: null }
  }
}
