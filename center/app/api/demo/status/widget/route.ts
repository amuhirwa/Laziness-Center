import { NextResponse } from "next/server"

// Demo widget — proves the widget fetch pipeline without a real module.
// Register the demo-status module via Admin → Modules to see this on the dashboard.
export function GET() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return NextResponse.json({
    title: "Center",
    primary: "Online",
    secondary: today,
    link: "/admin/modules",
  })
}
