import { LCClient } from "@lc/sdk"

const g = globalThis as unknown as { usLcClient: LCClient | undefined }

function buildRedisUrl(): string {
  const pw = process.env.REDIS_PASSWORD
  if (pw) return `redis://:${encodeURIComponent(pw)}@${process.env.REDIS_HOST ?? "redis"}:${process.env.REDIS_PORT ?? "6379"}`
  return process.env.REDIS_URL ?? "redis://redis:6379"
}

function getClient(): LCClient {
  if (!g.usLcClient) {
    g.usLcClient = new LCClient({
      moduleId: "us",
      centerUrl: process.env.CENTER_INTERNAL_URL!,
      redisUrl: buildRedisUrl(),
    })
  }
  return g.usLcClient
}

export const lc = new Proxy({} as LCClient, {
  get(_, prop: string | symbol) {
    const client = getClient()
    const val = Reflect.get(client, prop, client)
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(client) : val
  },
})
