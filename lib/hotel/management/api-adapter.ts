import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import {
  HotelManagementAuthorizationError,
  HotelManagementConflictError,
  HotelManagementValidationError,
} from "@/lib/hotel/management/hotel-management.service";

export function managementPrincipal(session: { user: { id: string; role: string; organizationId?: string | null } }) {
  return {
    userId: session.user.id,
    role: session.user.role as "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" | "GUEST",
    organizationId: session.user.organizationId,
  } as const;
}

export function managementError(error: unknown) {
  if (error instanceof HotelManagementValidationError) {
    return NextResponse.json({ error: "Invalid hotel management input" }, { status: 422 });
  }
  if (error instanceof HotelManagementAuthorizationError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof HotelManagementConflictError) {
    return NextResponse.json({ error: "Request conflict" }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ error: "Resource conflict" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }
  return jsonError(error);
}

export function parseJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "Request body must be an object");
  }
  return value;
}
