import { NextResponse } from "next/server"

// Demo widget — proves the widget fetch pipeline without a real module.
// Register the demo-note module via Admin → Modules to see this on the dashboard.
export function GET() {
  return NextResponse.json({
    title: "Getting Started",
    primary: "Welcome",
    secondary: "Register modules via Admin → Modules",
    link: "/admin/modules",
  })
}
