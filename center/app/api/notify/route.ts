import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { notifications } from "@/db/schema"
import { lc } from "@/lib/center-lc"

// Modules POST here to raise a notification for the user.
// Auth: service token — the request must carry a valid Center-minted JWT.
// The notification is stored in center.notifications and surfaced in the UI.
export async function POST(request: NextRequest) {
  const result = await lc.verifyToken(request.headers.get("authorization") ?? "")
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 401 })

  const body = await request.json() as {
    userId?: string
    title: string
    body: string
    link?: string
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 })
  }

  const [note] = await db.insert(notifications).values({
    id: crypto.randomUUID(),
    user_id: body.userId ?? "default",
    source_module: result.caller,
    title: body.title,
    body: body.body,
    link: body.link,
  }).returning({ id: notifications.id })

  return NextResponse.json({ notificationId: note.id }, { status: 201 })
}
