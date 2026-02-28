import { DefaultSession } from "next-auth";

type UserRole = "admin" | "editor" | "viewer";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
    };
    accessToken?: string;
  }

  interface User {
    [key: string]: unknown;
    id: string;
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: UserRole;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}

export {};
