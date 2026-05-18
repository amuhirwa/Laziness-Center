import NextAuth from "next-auth"

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
    jwt({ token, profile }) {
      if (profile) {
        const adminEmails = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim()).filter(Boolean)
        const groups = (profile.groups as string[] | undefined) ?? []
        const isAdmin = groups.includes("admin") || adminEmails.includes(token.email as string)
        token.role = isAdmin ? "admin" : "user"
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
