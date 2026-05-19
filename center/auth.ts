import NextAuth from "next-auth"
import { db } from "@/db"
import { users } from "@/db/schema"
import { sql } from "drizzle-orm"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "pocket-id",
      name: "Pocket ID",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID!,
      clientSecret: process.env.OIDC_CLIENT_SECRET!,
    },
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const adminEmails = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim()).filter(Boolean)
        const groups = (profile.groups as string[] | undefined) ?? []
        const isAdmin = groups.includes("admin") || adminEmails.includes(token.email as string)
        token.role = isAdmin ? "admin" : "user"

        // Upsert user record so the center knows who has logged in
        const email = token.email as string
        if (email) {
          await db.insert(users)
            .values({
              email,
              name: (token.name as string | null) ?? null,
              role: isAdmin ? "admin" : "user",
              last_login: new Date(),
            })
            .onConflictDoUpdate({
              target: users.email,
              set: {
                name: sql`EXCLUDED.name`,
                role: sql`EXCLUDED.role`,
                last_login: sql`NOW()`,
              },
            })
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = (token.role as "admin" | "user") ?? "user"
      }
      return session
    },
  },
})
