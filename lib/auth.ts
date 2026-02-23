import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { getDb } from "./db";

const ALLOWED_DOMAIN = "digital-gorilla.co.jp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = getDb();
        const user = db
          .prepare("SELECT * FROM users WHERE email = ?")
          .get(credentials.email as string) as {
          id: string;
          email: string;
          password_hash: string | null;
          name: string | null;
          role: string;
        } | undefined;

        if (!user || !user.password_hash) return null;

        const isValid = compareSync(
          credentials.password as string,
          user.password_hash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: check domain
      if (account?.provider === "google") {
        const email = user.email;
        if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          return false;
        }

        // Upsert user in DB
        const db = getDb();
        const existing = db
          .prepare("SELECT id FROM users WHERE email = ?")
          .get(email);

        if (!existing) {
          const { v4: uuidv4 } = await import("uuid");
          db.prepare(
            "INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, 'viewer')"
          ).run(uuidv4(), email, user.name);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const db = getDb();
        const dbUser = db
          .prepare("SELECT id, role FROM users WHERE email = ?")
          .get(token.email as string) as { id: string; role: string } | undefined;

        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        (session.user as Record<string, unknown>).role = token.role as string;
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
