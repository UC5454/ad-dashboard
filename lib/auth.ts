import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "digital-gorilla.co.jp";
type UserRole = "admin" | "editor" | "viewer";

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getEnv("AUTH_SECRET", "NEXTAUTH_SECRET"),
  trustHost: getEnv("AUTH_TRUST_HOST").toLowerCase() === "true" || process.env.VERCEL === "1",
  providers: [
    Google({
      clientId: getEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID"),
      clientSecret: getEnv("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET"),
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id ?? token.sub;
        token.role = "admin" as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.userId === "string"
            ? token.userId
            : typeof token.sub === "string"
              ? token.sub
              : "";
        session.user.role = "admin";
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
