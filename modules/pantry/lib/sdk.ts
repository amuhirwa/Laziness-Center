import { LCClient } from "@lc/sdk"

// Use a unique key per module to avoid cross-module collisions on globalThis
const g = globalThis as unknown as { pantryLcClient: LCClient | undefined }

function getClient(): LCClient {
  if (!g.pantryLcClient) {
    g.pantryLcClient = new LCClient({
      moduleId: "pantry",
      centerUrl: process.env.CENTER_INTERNAL_URL!,
      redisUrl: process.env.REDIS_URL!,
    })
  }
  return g.pantryLcClient
}

// Lazy Proxy: the LCClient is not constructed until the first method call.
// This allows the module to be imported at Next.js build time without env vars
// being present — construction only happens at runtime when env vars are set.
export const lc = new Proxy({} as LCClient, {
  get(_, prop: string | symbol) {
    const client = getClient()
    const val = Reflect.get(client, prop, client)
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(client) : val
  },
})
