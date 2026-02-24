import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "digital-gorilla.co.jp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = token.sub;
        token.role = "admin";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || token.sub || "";
        (session.user as unknown as Record<string, unknown>).role =
          (token.role as string) || "admin";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
