import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";

// Validation schema for registration - only username and password required
const OrganizationRegisterSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50, "Username must be less than 50 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  orgSlug: z.string().min(3, "Organization slug must be at least 3 characters").max(10, "Organization slug must be less than 10 characters"),
  orgName: z.string().min(3, "Organization slug must be at least 3 characters").max(10, "Organization slug must be less than 30 characters").optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = OrganizationRegisterSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage =
        validation.error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { username, password, orgSlug, orgName } = validation.data;

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { name: username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 },
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    // Create user with ADMIN role
    const user = await prisma.user.create({
      data: {
        name: username,
        password: hashedPassword,
        role: "ADMIN",
        isActive: true,
        isTeamMember: true,
        locale: "fa",
        theme: "system",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Auto-login by calling NextAuth signIn with credentials
    // This will create a session for the user
    try {
      const organization = await organizationService.create({
        slug: orgSlug,
        name: orgName || orgSlug,
        type: "SHOP",
      });

      if (!organization) {
        console.error("Error creation organization");
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
      const memeber = await organizationService.addMember(
        organization.id,
        user.id,
        "ADMIN",
        user.id,
      );
      const signInResult = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Even if signIn fails, user was created
        return NextResponse.json(
          {
            message: "User created successfully, but auto-login failed",
            user,
            autoLogin: false,
          },
          { status: 201 },
        );
      }

      return NextResponse.json(
        {
          message: "Organization and User created and logged in successfully",
          user,
          organization,
          memeber,
          autoLogin: true,
        },
        { status: 201 },
      );
    } catch (signInError) {
      console.error("Auto-login error:", signInError);
      return NextResponse.json(
        {
          message: "User created successfully",
          user,
          autoLogin: false,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("Error registering user with organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
