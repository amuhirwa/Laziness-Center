export type LCErrorKind =
  | "unreachable"      // network failure, timeout, DNS
  | "unauthorized"     // 401/403 from callee — token rejected
  | "not_found"        // 404 from callee
  | "client_error"     // any other 4xx
  | "server_error"     // any 5xx
  | "discovery_failed" // Center couldn't resolve the target
  | "config"           // SDK misconfigured — caught at startup

export class LCError extends Error {
  readonly kind: LCErrorKind
  readonly target?: string
  readonly status?: number
  readonly retryable: boolean
  override readonly cause?: unknown

  constructor(
    kind: LCErrorKind,
    target?: string,
    status?: number,
    retryable = false,
    cause?: unknown
  ) {
    super(
      `LCError(${kind}${target ? ` → ${target}` : ""}${status ? ` HTTP ${status}` : ""})`
    )
    this.name = "LCError"
    this.kind = kind
    this.target = target
    this.status = status
    this.retryable = retryable
    this.cause = cause
  }
}
