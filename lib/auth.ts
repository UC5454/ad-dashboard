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
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/presentations",
          access_type: "offline",
          prompt: "consent",
        },
      },
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
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id ?? token.sub;
        token.role = "admin" as UserRole;
      }

      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
      }

      if (
        token.accessToken &&
        token.accessTokenExpires &&
        typeof token.accessTokenExpires === "number" &&
        Date.now() < token.accessTokenExpires
      ) {
        return token;
      }

      if (token.refreshToken && typeof token.refreshToken === "string") {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: getEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID"),
              client_secret: getEnv("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET"),
              grant_type: "refresh_token",
              refresh_token: token.refreshToken,
            }),
          });

          if (response.ok) {
            const data = (await response.json()) as { access_token?: string; expires_in?: number };
            if (data.access_token) {
              token.accessToken = data.access_token;
              token.accessTokenExpires = Date.now() + (data.expires_in ?? 3600) * 1000;
            }
          }
        } catch {
          // refresh失敗時は既存トークンを返す
        }
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
      session.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
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
