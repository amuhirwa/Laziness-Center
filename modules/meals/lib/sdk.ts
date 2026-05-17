import { LCClient } from "@lc/sdk"

const globalForSdk = globalThis as unknown as { lcClient: LCClient }

export const lc =
  globalForSdk.lcClient ??
  new LCClient({
    moduleId: "meals",
    centerUrl: process.env.CENTER_INTERNAL_URL!,
    redisUrl: process.env.REDIS_URL!,
  })

if (process.env.NODE_ENV !== "production") globalForSdk.lcClient = lc
