import { auth } from "@/auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Temporary debug endpoint — remove after diagnosing admin role issue
export async function GET() {
  const session = await auth()
  return NextResponse.json({ session })
}
