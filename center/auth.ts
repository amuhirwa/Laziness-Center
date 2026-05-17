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
      if (profile?.groups) {
        const groups = profile.groups as string[]
        token.role = groups.includes("admin") ? "admin" : "user"
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
