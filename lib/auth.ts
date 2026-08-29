/**
 * NextAuth Configuration
 * 
 * This module configures NextAuth.js for authentication with:
 * - Credentials provider for username/password login
 * - Google OAuth provider
 * - JWT session strategy
 * - Custom user type extensions for role and organization
 */

import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/db"
import type { Provider } from "next-auth/providers"
import bcrypt from "bcryptjs";
import type { UserRole } from "./types";
import { appCookiePath, appPath } from "./app-base-path";

/**
 * NextAuth Type Extensions
 * 
 * Extend the default NextAuth types to include custom user properties.
 */
declare module "next-auth" {
  interface User {
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
    organizationId?: string | null;
  }
   interface Session{
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
    organizationId?: string | null;
   }

  interface JWT {
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
    organizationId?: string | null;
  }
}

/**
 * Build the authentication providers array
 */
const buildProviders = (): Provider[] => {
  const providers: Provider[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code",
          },
        },
      }),
    );
  }

  providers.push(
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: {
           label: "username",
           type: "text",
            placeholder: "Enter your username or email"
          },
        password: { 
          label: "Password", 
          type: "password",
          placeholder: "Enter your password"
        }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Invalid username or password");
        }

        const password = String(credentials.password);
        const identifier = String(credentials.username).trim().toLowerCase();

        if (!identifier || !password) {
          throw new Error("Invalid username or password");
        }

        const now = new Date();
        const lockDurationMs = 15 * 60 * 1000;
        const maxFailedAttempts = 5;

        const user = await prisma.user.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { name: identifier },
              { email: identifier },
              { phone: identifier },
            ],
          },
        });

        if (!user || !user.password) {
          throw new Error("Invalid username or password");
        }

        if (!user.isActive) {
          throw new Error("Account is disabled");
        }

        if (user.lockedUntil && user.lockedUntil > now) {
          throw new Error("Account is temporarily locked. Please try again later.");
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          const failedLoginAttempts = user.failedLoginAttempts + 1;
          const shouldLock = failedLoginAttempts >= maxFailedAttempts;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts,
              lockedUntil: shouldLock ? new Date(now.getTime() + lockDurationMs) : null,
            },
          });

          throw new Error(
            shouldLock
              ? "Account is temporarily locked. Please try again later."
              : "Invalid username or password",
          );
        }

        const organizationMember = user.isTeamMember
          ? await prisma.organizationMember.findFirst({
              where: {
                userId: user.id,
                isActive: true,
                organization: {
                  isActive: true,
                  deletedAt: null,
                },
              },
              orderBy: { joinedAt: "asc" },
              select: { organizationId: true },
            })
          : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: now,
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role,
          locale: user.locale,
          theme: user.theme,
          isTeamMember: user.isTeamMember || false,
          organizationId: organizationMember?.organizationId || null,
        };
      }
    }),
  );

  return providers;
};

const isProductionRuntime =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build";

if (isProductionRuntime && !process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET is required in production runtime");
}

const nextAuthSecret =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === "production" ? undefined : "development-secret-change-in-development-only");

/**
 * NextAuth Configuration
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Next.js strips its configured basePath before dispatching this route.
  // Browser clients receive the full mount path from SessionProvider.
  basePath: "/api/auth",
  cookies: {
    sessionToken: { options: { path: appCookiePath() } },
    callbackUrl: { options: { path: appCookiePath() } },
    csrfToken: { options: { path: appCookiePath() } },
    pkceCodeVerifier: { options: { path: appCookiePath() } },
    state: { options: { path: appCookiePath() } },
    nonce: { options: { path: appCookiePath() } },
    webauthnChallenge: { options: { path: appCookiePath() } },
  },
  // Use JWT for session management
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: nextAuthSecret,
  
  // Custom pages for authentication flows
  pages: {
    signIn: appPath("/fa/login"),
    error: appPath("/fa/login"),
  },
  
  // Authentication providers
  providers: buildProviders(),
  
  // Callbacks for customizing token and session behavior
  callbacks: {
    /**
     * JWT callback - called whenever a JWT is created or updated
     * Stores user info in the token
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as UserRole;
        token.isTeamMember = user.isTeamMember;
        token.locale = user.locale;
        token.theme = user.theme;
        token.organizationId = user.organizationId;
      }
      return token;
    },
    
    /**
     * Session callback - called whenever a session is checked
     * Maps token data to session user object
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.isTeamMember = token.isTeamMember as boolean;
        session.user.locale = token.locale as string;
        session.user.theme = token.theme as string;
        session.user.organizationId = token.organizationId as string | null;
      }
      //console.log("[Auth] session.user.name:", session.user.name);

      return session;
    },
    
    /**
     * SignIn callback - called after successful authentication
     * Can be used to prevent sign-ins based on user status
     */
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
            lockedUntil: true,
          },
        });

        const now = new Date();
        return Boolean(
          existingUser &&
            existingUser.isActive &&
            !existingUser.deletedAt &&
            (!existingUser.lockedUntil || existingUser.lockedUntil <= now),
        );
      }

      if (account?.provider === "credentials") {
        return true;
      }

      return false;
    },
  },
  
  // Event handlers for lifecycle events
  events: {
    /**
     * Called when a new user is created (e.g., via OAuth signup)
     */
    async createUser() {
      // User creation audit is intentionally handled in application routes.
    },
    async signIn() {
      // Avoid logging full user/session payloads in production.
    },
  },
  
  // Enable debug logging in development
  debug: process.env.NODE_ENV === "development",
});
