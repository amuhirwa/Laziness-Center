import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      role: "admin" | "user"
    } & DefaultSession["user"]
  }
}
