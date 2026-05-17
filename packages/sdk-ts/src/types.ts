/** Options passed to `new LCClient(...)`. */
export interface LCClientOptions {
  /** This module's registered ID (must match the manifest). */
  moduleId: string
  /** Base URL of the Center's internal API, e.g. http://center:3000. */
  centerUrl: string
  /** Redis connection URL, e.g. redis://:password@redis:6379. */
  redisUrl: string
  /** Service-discovery cache TTL in seconds. Default: 60. */
  serviceCacheTtl?: number
  /** Default HTTP call timeout in milliseconds. Default: 3000. */
  defaultTimeout?: number
  /** Structured logger. Defaults to console. */
  logger?: Logger
}

/** Options for `lc.call(target, opts)`. */
export interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  body?: unknown
  timeoutMs?: number
  /** Number of retries on 5xx. Default: 0. Each retry doubles the delay (100ms, 200ms, …). */
  retries?: number
}

/** Options for `lc.publish(opts)`. */
export interface PublishOptions {
  /** Full event name, e.g. `pantry.purchase.recorded`. Must be declared in manifest. */
  event: string
  data: unknown
  /** Payload schema version. Default: 1. */
  version?: number
  /**
   * Transport mechanism. Default: "pubsub".
   * Use "stream" for durable events that subscribers must not miss (e.g. purchase recorded).
   * Use "pubsub" for best-effort cache-hint events (e.g. inventory changed).
   */
  transport?: "pubsub" | "stream"
}

/** Options for `lc.subscribe(name, handler, opts)`. */
export interface SubscribeOptions {
  /**
   * Transport to consume from. Must match what the publisher uses.
   * Default: "pubsub".
   */
  transport?: "pubsub" | "stream"
}

/** Wire shape of every event — what subscribers receive. */
export interface LCEvent {
  /** UUIDv4 unique per event delivery. Use as idempotency key. */
  id: string
  event: string
  version: number
  /** ISO-8601 timestamp. */
  ts: string
  source_module: string
  data: unknown
}

export type EventHandler = (event: LCEvent) => Promise<void>

export interface Logger {
  info(msg: string | object, ...args: unknown[]): void
  warn(msg: string | object, ...args: unknown[]): void
  error(msg: string | object, ...args: unknown[]): void
}
