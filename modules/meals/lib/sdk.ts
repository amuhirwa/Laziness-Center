import { LCClient } from "@lc/sdk"

const g = globalThis as unknown as { mealsLcClient: LCClient | undefined }

function buildRedisUrl(): string {
  const pw = process.env.REDIS_PASSWORD
  if (pw) return `redis://:${encodeURIComponent(pw)}@${process.env.REDIS_HOST ?? "redis"}:${process.env.REDIS_PORT ?? "6379"}`
  return process.env.REDIS_URL ?? "redis://redis:6379"
}

function getClient(): LCClient {
  if (!g.mealsLcClient) {
    g.mealsLcClient = new LCClient({
      moduleId: "meals",
      centerUrl: process.env.CENTER_INTERNAL_URL!,
      redisUrl: buildRedisUrl(),
    })
  }
  return g.mealsLcClient
}

// Lazy Proxy: see pantry/lib/sdk.ts for explanation.
export const lc = new Proxy({} as LCClient, {
  get(_, prop: string | symbol) {
    const client = getClient()
    const val = Reflect.get(client, prop, client)
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(client) : val
  },
})
