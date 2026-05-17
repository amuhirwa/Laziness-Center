/**
 * Center-side service token verifier.
 * The Center verifies tokens that modules present when calling Center endpoints
 * (e.g., POST /api/notify). It uses the Center's own public key — which it
 * generated — so no network fetch is needed for the key material.
 */
import { jwtVerify } from "jose"
import { getPublicKey } from "./jwt"

export const lc = {
  async verifyToken(
    authHeader: string
  ): Promise<{ ok: true; caller: string } | { ok: false; reason: string }> {
    if (!authHeader.startsWith("Bearer ")) return { ok: false, reason: "missing bearer" }
    const token = authHeader.slice(7)
    try {
      const publicKey = await getPublicKey()
      // aud is the Center's own service ID when modules call the Center
      const { payload } = await jwtVerify(token, publicKey, { issuer: "lc-center" })
      if (!payload.sub) return { ok: false, reason: "missing sub" }
      return { ok: true, caller: payload.sub }
    } catch (e) {
      return { ok: false, reason: String(e) }
    }
  },
}
