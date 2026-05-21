import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

// Required auth — used by forward_auth for protected modules (pantry, us, manhwa).
// Returns 200 + identity headers when authenticated.
// Returns 302 to /login with callbackUrl when not.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    const forwardedUri = request.headers.get("x-forwarded-uri") ?? "/"
    const location = `/login?callbackUrl=${encodeURIComponent(forwardedUri)}`
    return new NextResponse(null, { status: 302, headers: { Location: location } })
  }
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Remote-Email": session.user.email,
      "Remote-Name": session.user.name ?? "",
    },
  })
}
