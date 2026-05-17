import { mintServiceToken } from "@/lib/jwt"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const BodySchema = z.object({
  caller: z.string().min(1),
  target: z.string().min(1),
})

// POST /internal/token
// Mints a 5-minute RS256 JWT allowing `caller` to authenticate against `target`.
// The JWT carries: iss=lc-center, sub=caller, aud=target, exp=+5m, jti=uuid.
// Reachable only from the Docker internal network — Caddy blocks /internal/* publicly.
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "caller and target are required" }, { status: 400 })
  }

  const token = await mintServiceToken(parsed.data.caller, parsed.data.target)
  return NextResponse.json({ token })
}
