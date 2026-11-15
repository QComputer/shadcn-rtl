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
import type { DefaultSession } from "next-auth"
import bcrypt from "bcryptjs";
import type { UserRole } from "./types";
import { appCookiePath, appPath } from "./app-base-path";
import { credentialBinding } from "./security/credential-binding";
import { validateSessionCredential } from "./security/session-credential.server";
import { resolveCustomerAuthContext } from "./customer-auth/context.server";
import { customerPhoneAuthService, createCustomerPasswordSession, validateCustomerPhoneSession, revokeCustomerPhoneSession } from "./customer-auth/core.server";
import { customerSsoService } from "./customer-auth/sso.server";

/**
 * NextAuth Type Extensions
 *
 * Extend the default NextAuth types to include custom user properties.
 */
declare module "next-auth" {
  interface User {
    phoneSessionId?: string;
    customerOrigin?: string;
    credentialBinding?: string;
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
    organizationId?: string | null;
  }
  interface Session {
    user: DefaultSession["user"] & {
      phoneSessionId?: string;
      customerOrigin?: string;
      role?: UserRole;
      locale?: string;
      isTeamMember?: boolean;
      theme?: string;
      organizationId?: string | null;
    };
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
    organizationId?: string | null;
  }

  interface JWT {
    phoneSessionId?: string;
    customerOrigin?: string;
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
      async authorize(credentials, request) {
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

        const matchedUsers = await prisma.user.findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { equals: identifier, mode: "insensitive" } },
              { email: identifier },
              { phone: identifier },
            ],
          },
          take: 2,
        });

        // Case-folded legacy username collisions must fail closed rather than
        // authenticating whichever record the database happens to return first.
        if (matchedUsers.length !== 1) throw new Error("Invalid username or password");
        const user = matchedUsers[0];

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

        let phoneSessionId: string | undefined;
        let customerOrganizationId: string | undefined;
        let customerOrigin: string | undefined;
        if (user.role === "CUSTOMER") {
          const context = await resolveCustomerAuthContext(request);
          if (!context || request.headers.get("origin") !== context.origin) return null;
          try {
            phoneSessionId = await createCustomerPasswordSession(user.id, context.organizationId);
            customerOrganizationId = context.organizationId;
            customerOrigin = context.origin;
          } catch {
            return null;
          }
        }

        const organizationMember = user.isTeamMember
          ? await prisma.organizationMember.findFirst({
              where: {
                userId: user.id,
                isActive: true,
                // Customer memberships must not select the active team tenant
                // after recipient-bound organization access is activated.
                role: { in: ["ADMIN", "MANAGER", "STAFF", "DRIVER"] },
                organization: {
                  isActive: true,
                  deletedAt: null,
                },
              },
              orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
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
          organizationId: customerOrganizationId ?? organizationMember?.organizationId ?? null,
          phoneSessionId,
          customerOrigin,
          credentialBinding: credentialBinding(user.id, user.password, nextAuthSecret!),
        };
      }
    }),
  );

  providers.push(CredentialsProvider({
    id: "customer-phone",
    name: "ورود مشتری با شماره موبایل",
    credentials: { token: { type: "password" }, otp: { type: "password" }, phone: { type: "text" }, organization: { type: "text" } },
    async authorize(credentials, request) {
      if (typeof credentials?.organization !== "string") return null;
      const context = await resolveCustomerAuthContext(request, credentials.organization);
      if (!context || request.headers.get("origin") !== context.origin) return null;
      try {
        const customer = await customerPhoneAuthService.consume({ token: typeof credentials?.token === "string" ? credentials.token : undefined, otp: typeof credentials?.otp === "string" ? credentials.otp : undefined, phone: typeof credentials?.phone === "string" ? credentials.phone : undefined, organizationId: context.organizationId, origin: context.origin });
        return { id: customer.id, name: customer.name, role: "CUSTOMER", isTeamMember: false,
          locale: customer.locale, theme: customer.theme, organizationId: context.organizationId,
          phoneSessionId: customer.phoneSessionId,
          customerOrigin: context.origin,
          credentialBinding: credentialBinding(customer.id, customer.password, nextAuthSecret!) };
      } catch { return null; }
    },
  }));

  providers.push(CredentialsProvider({
    id: "customer-sso",
    name: "ورود یکپارچه مشتری",
    credentials: { ticket: { type: "password" }, organization: { type: "text" } },
    async authorize(credentials, request) {
      if (typeof credentials?.ticket !== "string" || typeof credentials?.organization !== "string") return null;
      const context = await resolveCustomerAuthContext(request, credentials.organization);
      if (!context || request.headers.get("origin") !== context.origin) return null;
      const cookieName = context.origin.startsWith("https:") ? "__Host-bazar-customer-sso" : "bazar-customer-sso";
      const verifier = request.headers.get("cookie")?.split(";").map(value => value.trim())
        .find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
      if (!verifier || !/^[A-Za-z0-9_-]{43}$/.test(verifier)) return null;
      try {
        const customer = await customerSsoService.redeem({ ticket: credentials.ticket, organizationId: context.organizationId, origin: context.origin, verifier });
        return { id: customer.id, name: customer.name, role: "CUSTOMER", isTeamMember: false,
          locale: customer.locale, theme: customer.theme, organizationId: context.organizationId,
          phoneSessionId: customer.phoneSessionId,
          customerOrigin: context.origin,
          credentialBinding: credentialBinding(customer.id, customer.password, nextAuthSecret!) };
      } catch { return null; }
    },
  }));

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
    csrfToken: { options: { path: "/" } }, // Fixed: __Host- cookies require Path=/
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
        // Bind to the credential actually verified by the provider, not a
        // later password fetched after a concurrent reset.
        token.credentialBinding = user.credentialBinding;
        token.phoneSessionId = user.phoneSessionId;
        token.customerOrigin = user.customerOrigin;
        if (!user.credentialBinding) return null;
      }
      const current = await validateSessionCredential(token, nextAuthSecret!);
      if (!current) return null;
      token.credentialBinding = current.binding;
      token.role = current.user.role;
      if (current.user.role === "CUSTOMER") {
        if (typeof token.phoneSessionId !== "string" || typeof token.customerOrigin !== "string" || typeof token.organizationId !== "string" ||
          !await validateCustomerPhoneSession({ sessionId: token.phoneSessionId, userId: token.id as string, organizationId: token.organizationId })) return null;
        token.role = "CUSTOMER";
        token.isTeamMember = false;
      } else if (token.phoneSessionId !== undefined || token.customerOrigin !== undefined) {
        return null;
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
        session.user.phoneSessionId = typeof token.phoneSessionId === "string" ? token.phoneSessionId : undefined;
        session.user.customerOrigin = typeof token.customerOrigin === "string" ? token.customerOrigin : undefined;
      }
      //console.log("[Auth] session.user.name:", session.user.name);

      return session;
    },

    /**
     * SignIn callback - called after successful authentication
     * Can be used to prevent sign-ins based on user status
     */
    async signIn({ user, account }) {
      if (account?.provider === "customer-phone" || account?.provider === "customer-sso") {
        return user.role === "CUSTOMER" && user.isTeamMember === false &&
          typeof user.phoneSessionId === "string" && typeof user.organizationId === "string" &&
          await validateCustomerPhoneSession({ sessionId: user.phoneSessionId, userId: user.id as string, organizationId: user.organizationId });
      }
      if (account?.provider === "google") {
        if (!user.email) return false;

        const existingUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: {
            id: true,
            isActive: true,
            deletedAt: true,
            lockedUntil: true,
            password: true,
            role: true,
            locale: true,
            theme: true,
            isTeamMember: true,
          },
        });

        const now = new Date();
        const allowed = Boolean(
          existingUser &&
            existingUser.isActive &&
            !existingUser.deletedAt &&
            (!existingUser.lockedUntil || existingUser.lockedUntil <= now),
        );
        if (allowed && existingUser) {
          user.id = existingUser.id;
          user.role = existingUser.role;
          user.locale = existingUser.locale;
          user.theme = existingUser.theme;
          user.isTeamMember = existingUser.isTeamMember;
          user.credentialBinding = credentialBinding(existingUser.id, existingUser.password, nextAuthSecret!);
          const member = existingUser.isTeamMember ? await prisma.organizationMember.findFirst({
            where: { userId: existingUser.id, isActive: true, role: { in: ["ADMIN", "MANAGER", "STAFF", "DRIVER"] }, organization: { isActive: true, deletedAt: null } },
            orderBy: [{ joinedAt: "asc" }, { id: "asc" }], select: { organizationId: true },
          }) : null;
          user.organizationId = member?.organizationId ?? null;
        }
        return allowed;
      }

      if (account?.provider === "credentials") {
        if (user.role !== "CUSTOMER") return true;
        return user.isTeamMember === false && typeof user.phoneSessionId === "string" &&
          typeof user.customerOrigin === "string" && typeof user.organizationId === "string" &&
          await validateCustomerPhoneSession({ sessionId: user.phoneSessionId, userId: user.id as string, organizationId: user.organizationId });
      }

      return false;
    },
  },

  // Event handlers for lifecycle events
  events: {
    async signOut(message) {
      if ("token" in message && typeof message.token?.phoneSessionId === "string" && typeof message.token?.id === "string") {
        await revokeCustomerPhoneSession({ sessionId: message.token.phoneSessionId, userId: message.token.id });
      }
    },
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
  debug: false,
});
