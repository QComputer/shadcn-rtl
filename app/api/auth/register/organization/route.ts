import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { ApiError, jsonError } from "@/lib/api-guards";
import { slugSchema } from "@/lib/validators";

const organizationRegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  orgSlug: slugSchema,
  orgName: z
    .string()
    .trim()
    .min(3, "Organization name must be at least 3 characters")
    .max(30, "Organization name must be less than 30 characters")
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = organizationRegisterSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || "Validation failed";
      throw new ApiError(400, errorMessage);
    }

    const { username, password, orgSlug, orgName } = validation.data;
    const hashedPassword = await bcrypt.hash(password, 12);

    const { user, organization, member } = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { name: username },
        select: { id: true },
      });

      if (existingUser) {
        throw new ApiError(409, "Username already taken");
      }

      const existingOrganization = await tx.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true },
      });

      if (existingOrganization) {
        throw new ApiError(409, "Organization slug already taken");
      }

      const createdUser = await tx.user.create({
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

      const createdOrganization = await tx.organization.create({
        data: {
          slug: orgSlug,
          name: orgName || orgSlug,
          type: "SHOP",
        },
      });

      await tx.organizationSettings.create({
        data: { organizationSlug: createdOrganization.slug },
      });

      await tx.paymentSettings.create({
        data: { organizationSlug: createdOrganization.slug },
      });

      const createdMember = await tx.organizationMember.create({
        data: {
          organizationId: createdOrganization.id,
          organizationSlug: createdOrganization.slug,
          userId: createdUser.id,
          role: "ADMIN",
          isActive: true,
        },
      });

      return {
        user: createdUser,
        organization: createdOrganization,
        member: createdMember,
      };
    });

    try {
      const signInResult = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        return NextResponse.json(
          {
            message: "Organization and user created successfully, but auto-login failed",
            user,
            organization,
            member,
            // Backward compatibility for existing clients with the old misspelled key.
            memeber: member,
            autoLogin: false,
          },
          { status: 201 },
        );
      }

      return NextResponse.json(
        {
          message: "Organization and user created and logged in successfully",
          user,
          organization,
          member,
          // Backward compatibility for existing clients with the old misspelled key.
          memeber: member,
          autoLogin: true,
        },
        { status: 201 },
      );
    } catch (signInError) {
      console.error("Auto-login error:", signInError);
      return NextResponse.json(
        {
          message: "Organization and user created successfully",
          user,
          organization,
          member,
          // Backward compatibility for existing clients with the old misspelled key.
          memeber: member,
          autoLogin: false,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("Error registering user with organization:", error);
    return jsonError(error, "Internal server error");
  }
}
