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
  }
   interface Session{
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
   }

  interface JWT {
    role?: UserRole;
    locale?: string;
    isTeamMember?: boolean;
    theme?: string;
    name?: string;
  }
}

/**
 * Build the authentication providers array
 */
const buildProviders = (): Provider[] => {
  const providers: Provider[] = [
    /**
     * Google OAuth Provider
     * Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables
     */
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    
    /**
     * Credentials Provider for username/password authentication
     */
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
           label: "Email",
           type: "email",
            placeholder: "Enter your email"
          },
        password: { 
          label: "Password", 
          type: "password",
          placeholder: "Enter your password"
        }
      },
      async authorize(credentials) {
        // Validate that credentials are provided
        if (!credentials?.email || !credentials?.password) {
          console.warn("[Auth] Missing credentials during sign-in attempt");
          throw new Error("Username and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        
        // Normalize username to lowercase for consistent lookup
        //const normalizedUsername = username.trim().toLowerCase();

        try {
          // Find user by username
          const user = await prisma.user.findFirst({
            where: { email },
          });

          // User not found
          if (!user) {
            console.warn(`[Auth] User not found: ${email}`);
            throw new Error("Invalid username or password");
          }

          // User has no password set (OAuth user trying to use credentials)
          if (!user.password) {
            console.warn(`[Auth] OAuth user attempted credentials login: ${email}`);
            return null;
          }

          // Verify password
          const validPassword = await bcrypt.compare(password, user.password);
          if (!validPassword) {
            console.warn(`[Auth] Invalid password for user: ${email}`);
            throw new Error("Invalid username or password");
          }

          // Return user object with required fields
          console.log(`[Auth] Successful sign-in for user: ${user}`);
          return {
            id: user.id,
            email: user.email,
            //name: normalizedUsername || undefined,
            role: user.role,
          };
        } catch (error) {
          console.error("[Auth] Error during credentials validation:", error);
          throw error;
        }
      },
    }),
  ];

  return providers;
};

/**
 * NextAuth Configuration
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  // Use JWT for session management
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  
  // Custom pages for authentication flows
  pages: {
    signIn: "/login",
    error: "/login",
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
      }
      console.log('[Auth] session.user.username:', session.user);

      return session;
    },
    
    /**
     * SignIn callback - called after successful authentication
     * Can be used to prevent sign-ins based on user status
     */
    async signIn({ user, account }) {
      // Allow OAuth sign-ins
      if (account?.provider === "google") {
        return true;
      }
      
      // Allow credentials sign-ins (already validated in authorize)
      if (account?.provider === "credentials") {
        return true;
      }
      
      // Default: allow sign-in
      return true;
    },
  },
  
  // Event handlers for lifecycle events
  events: {
    /**
     * Called when a new user is created (e.g., via OAuth signup)
     */
    async createUser({ user }) {
      console.log("[Auth] New user created via OAuth:", user);
    },
     /**
     * Called when a user signed in  (e.g., via OAuth signin)
     */
    async signIn({ user }) {
      console.log("[Auth][Event] A user signed in via OAuth:", user);
    },
  },
  
  // Enable debug logging in development
  debug: process.env.NODE_ENV === "development",
});
