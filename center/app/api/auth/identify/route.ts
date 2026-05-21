import { NextResponse } from "next/server"
import { auth } from "@/auth"

// Optional auth — used by forward_auth for public modules (meals).
// Always returns 200 so unauthenticated users pass through as guests.
// Injects Remote-Email when a session exists so logged-in users get their identity.
export async function GET() {
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.user?.email) {
    headers["Remote-Email"] = session.user.email
    if (session.user.name) headers["Remote-Name"] = session.user.name
  }
  return new NextResponse(null, { status: 200, headers })
}
