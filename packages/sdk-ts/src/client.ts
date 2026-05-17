import Redis from "ioredis"
import { importJWK, jwtVerify, type JWK } from "jose"
import { LCError } from "./error"
import type {
  CallOptions,
  EventHandler,
  LCClientOptions,
  LCEvent,
  Logger,
  PublishOptions,
  SubscribeOptions,
} from "./types"

const DEFAULT_TIMEOUT_MS = 3000
const DEFAULT_CACHE_TTL_S = 60
const TOKEN_REFRESH_BUFFER_S = 30

const defaultLogger: Logger = {
  info: (...a) => console.info(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
}

interface SubscriptionEntry {
  handlers: EventHandler[]
  transport: "pubsub" | "stream"
}

export class LCClient {
  private readonly moduleId: string
  private readonly centerUrl: string
  private readonly redisUrl: string
  private readonly serviceCacheTtl: number
  private readonly defaultTimeout: number
  private readonly logger: Logger

  private readonly discoveryCache = new Map<string, { url: string; expiresAt: number }>()
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>()
  private readonly subscriptions = new Map<string, SubscriptionEntry>()

  private _publicKey: CryptoKey | null = null
  private _redis: Redis | null = null

  constructor(opts: LCClientOptions) {
    if (!opts.moduleId) throw new LCError("config", undefined, undefined, false, "moduleId required")
    if (!opts.centerUrl) throw new LCError("config", undefined, undefined, false, "centerUrl required")
    if (!opts.redisUrl) throw new LCError("config", undefined, undefined, false, "redisUrl required")

    this.moduleId = opts.moduleId
    this.centerUrl = opts.centerUrl.replace(/\/$/, "")
    this.redisUrl = opts.redisUrl
    this.serviceCacheTtl = opts.serviceCacheTtl ?? DEFAULT_CACHE_TTL_S
    this.defaultTimeout = opts.defaultTimeout ?? DEFAULT_TIMEOUT_MS
    this.logger = opts.logger ?? defaultLogger
  }

  // ── Service discovery ────────────────────────────────────────────────────────

  private async discoverService(target: string): Promise<string> {
    const cached = this.discoveryCache.get(target)
    if (cached && cached.expiresAt > Date.now()) return cached.url

    const res = await fetch(`${this.centerUrl}/internal/registry/services/${target}`)
    if (!res.ok) throw new LCError("discovery_failed", target)
    const { base_url } = (await res.json()) as { base_url: string }

    this.discoveryCache.set(target, {
      url: base_url,
      expiresAt: Date.now() + this.serviceCacheTtl * 1000,
    })
    return base_url
  }

  // ── Service token ────────────────────────────────────────────────────────────

  private async getServiceToken(target: string): Promise<string> {
    const key = `${this.moduleId}→${target}`
    const cached = this.tokenCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.token

    const res = await fetch(`${this.centerUrl}/internal/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caller: this.moduleId, target }),
    })
    if (!res.ok) throw new LCError("discovery_failed", target)
    const { token } = (await res.json()) as { token: string }

    this.tokenCache.set(key, {
      token,
      expiresAt: Date.now() + (300 - TOKEN_REFRESH_BUFFER_S) * 1000,
    })
    return token
  }

  // ── call ─────────────────────────────────────────────────────────────────────

  async call<T = unknown>(target: string, opts: CallOptions): Promise<T> {
    const [baseUrl, token] = await Promise.all([
      this.discoverService(target),
      this.getServiceToken(target),
    ])

    const url = `${baseUrl.replace(/\/$/, "")}${opts.path}`
    const timeout = opts.timeoutMs ?? this.defaultTimeout
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      })

      if (res.status === 404) throw new LCError("not_found", target, 404, false)
      if (res.status === 401 || res.status === 403) throw new LCError("unauthorized", target, res.status, false)
      if (res.status >= 400 && res.status < 500) throw new LCError("client_error", target, res.status, false)
      if (res.status >= 500) {
        if ((opts.retries ?? 0) > 0) {
          clearTimeout(timer)
          await new Promise((r) => setTimeout(r, 100))
          return this.call<T>(target, { ...opts, retries: (opts.retries ?? 0) - 1 })
        }
        throw new LCError("server_error", target, res.status, true)
      }

      return (await res.json()) as T
    } catch (e) {
      if (e instanceof LCError) throw e
      const isAbort = e instanceof Error && e.name === "AbortError"
      throw new LCError("unreachable", target, undefined, isAbort, e)
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────────────

  async publish(opts: PublishOptions): Promise<void> {
    const event: LCEvent = {
      id: crypto.randomUUID(),
      event: opts.event,
      version: opts.version ?? 1,
      ts: new Date().toISOString(),
      source_module: this.moduleId,
      data: opts.data,
    }

    const redis = this.getRedis()

    if (opts.transport === "stream") {
      // Redis Streams — durable, consumer-group semantics
      await redis.xadd(opts.event, "*", "id", event.id, "payload", JSON.stringify(event))
    } else {
      // Redis Pub/Sub — best-effort, fire-and-forget
      await redis.publish(opts.event, JSON.stringify(event))
    }

    this.logger.info({ publish: opts.event, transport: opts.transport ?? "pubsub", id: event.id }, "event published")
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────────

  subscribe(eventName: string, handler: EventHandler, opts?: SubscribeOptions): void {
    const transport = opts?.transport ?? "pubsub"
    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, { handlers: [], transport })
    }
    this.subscriptions.get(eventName)!.handlers.push(handler)
  }

  async startSubscriptions(): Promise<void> {
    if (this.subscriptions.size === 0) return

    const pubsubChannels: string[] = []
    const streamChannels: string[] = []

    for (const [name, entry] of this.subscriptions) {
      if (entry.transport === "stream") streamChannels.push(name)
      else pubsubChannels.push(name)
    }

    if (pubsubChannels.length > 0) {
      const subscriber = new Redis(this.redisUrl)
      subscriber.on("message", (channel: string, message: string) => {
        const entry = this.subscriptions.get(channel)
        if (!entry) return
        let event: LCEvent
        try { event = JSON.parse(message) as LCEvent } catch { return }
        for (const handler of entry.handlers) {
          handler(event).catch((e) =>
            this.logger.error({ event: channel, id: event.id, error: e }, "pubsub handler failed")
          )
        }
      })
      await subscriber.subscribe(...pubsubChannels)
      this.logger.info({ channels: pubsubChannels }, "pubsub subscriptions started")
    }

    for (const streamKey of streamChannels) {
      this.startStreamConsumer(streamKey)
    }
  }

  private startStreamConsumer(streamKey: string): void {
    const groupName = this.moduleId
    const consumerName = `${this.moduleId}-0`
    const entry = this.subscriptions.get(streamKey)!
    const redis = new Redis(this.redisUrl)

    const dlqKey = `lc:dlq:${this.moduleId}`
    const maxRetries = 5

    const poll = async () => {
      try {
        // Ensure consumer group exists
        await redis.xgroup("CREATE", streamKey, groupName, "$", "MKSTREAM").catch(() => {})

        const results = await (redis as Redis).call(
          "XREADGROUP",
          "GROUP", groupName, consumerName,
          "COUNT", "10",
          "BLOCK", "2000",
          "STREAMS", streamKey, ">"
        ) as Array<[string, Array<[string, string[]]>]> | null

        for (const [, messages] of results ?? []) {
          for (const [messageId, fields] of messages) {
            const payloadIdx = fields.indexOf("payload")
            if (payloadIdx === -1 || payloadIdx + 1 >= fields.length) {
              await redis.xack(streamKey, groupName, messageId)
              continue
            }

            let event: LCEvent
            try {
              event = JSON.parse(fields[payloadIdx + 1]) as LCEvent
            } catch {
              await redis.xack(streamKey, groupName, messageId)
              continue
            }

            let succeeded = false
            for (const handler of entry.handlers) {
              try {
                await handler(event)
                succeeded = true
              } catch (e) {
                this.logger.error({ stream: streamKey, id: messageId, error: e }, "stream handler failed")
              }
            }

            if (succeeded) {
              await redis.xack(streamKey, groupName, messageId)
            } else {
              // Check delivery count — move to DLQ after maxRetries
              const pending = await redis.xpending(streamKey, groupName, messageId, messageId, 1) as unknown[]
              const pendingEntry = pending?.[0] as unknown[] | undefined
              const deliveryCount = pendingEntry?.[3] as number | undefined
              if (deliveryCount && deliveryCount >= maxRetries) {
                await redis.xadd(dlqKey, "*", "stream", streamKey, "messageId", messageId, "payload", fields[payloadIdx + 1])
                await redis.xack(streamKey, groupName, messageId)
                this.logger.warn({ stream: streamKey, id: messageId }, "moved to DLQ after max retries")
              }
            }
          }
        }
      } catch (e) {
        this.logger.warn({ stream: streamKey, error: e }, "stream consumer error")
      }

      setImmediate(poll)
    }

    poll()
    this.logger.info({ stream: streamKey, group: groupName }, "stream consumer started")
  }

  // ── Token verification ────────────────────────────────────────────────────────

  async verifyToken(authHeader: string): Promise<{ ok: true; caller: string } | { ok: false; reason: string }> {
    if (!authHeader.startsWith("Bearer ")) return { ok: false, reason: "missing bearer token" }
    const token = authHeader.slice(7)
    try {
      const publicKey = await this.fetchPublicKey()
      if (!publicKey) return { ok: false, reason: "could not fetch Center public key" }
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: "lc-center",
        audience: this.moduleId,
      })
      if (!payload.sub) return { ok: false, reason: "missing sub claim" }
      return { ok: true, caller: payload.sub }
    } catch (e) {
      return { ok: false, reason: String(e) }
    }
  }

  verifyServiceToken() {
    return async (
      req: { headers?: { authorization?: string }; lcCaller?: string },
      res: { status: (c: number) => { json: (b: unknown) => void } },
      next: () => void
    ) => {
      const result = await this.verifyToken(req.headers?.authorization ?? "")
      if (!result.ok) { res.status(401).json({ error: result.reason }); return }
      req.lcCaller = result.caller
      next()
    }
  }

  private async fetchPublicKey(): Promise<CryptoKey | null> {
    if (this._publicKey) return this._publicKey
    try {
      const res = await fetch(`${this.centerUrl}/internal/jwks`)
      if (!res.ok) return null
      const jwk = (await res.json()) as JWK
      this._publicKey = (await importJWK(jwk, "RS256")) as CryptoKey
      return this._publicKey
    } catch {
      return null
    }
  }

  // ── Redis ─────────────────────────────────────────────────────────────────────

  private getRedis(): Redis {
    if (!this._redis) this._redis = new Redis(this.redisUrl)
    return this._redis
  }
}
