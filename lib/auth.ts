import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { getDb } from "@/lib/db";

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

function getUserRoleByEmail(email?: string | null): UserRole {
  if (!email) return "viewer";
  const db = getDb();
  const user = db
    .prepare("SELECT role FROM users WHERE email = ? LIMIT 1")
    .get(email) as { role?: UserRole } | undefined;
  return user?.role ?? "viewer";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getEnv("AUTH_SECRET", "NEXTAUTH_SECRET"),
  trustHost:
    getEnv("AUTH_TRUST_HOST").toLowerCase() === "true" ||
    process.env.VERCEL === "1",
  providers: [
    Google({
      clientId: getEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID"),
      clientSecret: getEnv("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET"),
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          return null;
        }

        const db = getDb();
        const user = db
          .prepare(
            "SELECT id, email, name, role, password_hash FROM users WHERE email = ? LIMIT 1",
          )
          .get(email) as
          | {
              id: string;
              email: string;
              name: string | null;
              role: UserRole | null;
              password_hash: string | null;
            }
          | undefined;

        if (!user?.password_hash) {
          return null;
        }

        const isValid = await compare(password, user.password_hash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email.split("@")[0] ?? "ユーザー",
          role: user.role ?? "viewer",
        };
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
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id ?? token.sub;
        token.role =
          (user as { role?: UserRole }).role ?? getUserRoleByEmail(user.email);
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
        session.user.role =
          token.role === "admin" || token.role === "editor" || token.role === "viewer"
            ? token.role
            : "viewer";
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
