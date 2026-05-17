import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
})

export const config = {
  // Protect only UI routes. Exclude:
  //   api/       — widget endpoints + NextAuth callbacks; secured at route level
  //   internal/  — Docker-network-only; blocked at Caddy for public traffic
  //   _next/     — static assets
  //   favicon    — browser requests
  matcher: [
    "/((?!api|internal|_next/static|_next/image|favicon.ico).*)",
  ],
}
