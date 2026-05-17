import { getPublicJwk } from "@/lib/jwt"
import { NextResponse } from "next/server"

// GET /internal/jwks
// Returns the Center's RSA public key as a JWK.
// Modules fetch this once on startup and cache it to verify incoming service tokens locally.
// Reachable only from the Docker internal network — Caddy blocks /internal/* publicly.
export async function GET() {
  const jwk = await getPublicJwk()
  return NextResponse.json(jwk, {
    headers: {
      // Modules may cache this — keys only rotate on Center restart
      "Cache-Control": "public, max-age=3600",
    },
  })
}
