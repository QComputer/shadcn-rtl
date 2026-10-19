import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { Prisma } from "@prisma/client";

class TestApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
class TestAuthorizationError extends Error {}
class TestValidationError extends Error {}

mock.module("@/lib/api-guards", {
  namedExports: {
    ApiError: TestApiError,
    jsonError: (error: unknown) => {
      const status = error instanceof TestApiError ? error.status : 500;
      return new Response(JSON.stringify({ error: status >= 500 ? "Internal server error" : (error as Error).message }), { status });
    },
  },
});
mock.module("@/lib/hotel/management/hotel-management.service", {
  namedExports: {
    HotelManagementAuthorizationError: TestAuthorizationError,
    HotelManagementValidationError: TestValidationError,
  },
});

let managementError: typeof import("../../lib/hotel/management/api-adapter").managementError;
before(async () => {
  ({ managementError } = await import("../../lib/hotel/management/api-adapter"));
});

async function body(response: Response) {
  return response.json() as Promise<{ error: string }>;
}

test("shared adapter maps authentication and authorization errors", async () => {
  assert.equal(managementError(new TestApiError(401, "Unauthorized")).status, 401);
  assert.equal(managementError(new TestAuthorizationError("internal membership detail")).status, 403);
  assert.deepEqual(await body(managementError(new TestAuthorizationError("secret tenant detail"))), { error: "Forbidden" });
});

test("shared adapter maps validation, conflict, and missing-resource errors", async () => {
  assert.equal(managementError(new TestValidationError("private validation detail")).status, 422);
  assert.deepEqual(await body(managementError(new TestValidationError("private validation detail"))), { error: "Invalid hotel management input" });
  const duplicate = new Prisma.PrismaClientKnownRequestError("raw SQL and schema detail", { code: "P2002", clientVersion: "6" });
  const missing = new Prisma.PrismaClientKnownRequestError("raw SQL and schema detail", { code: "P2025", clientVersion: "6" });
  assert.deepEqual(await body(managementError(duplicate)), { error: "Resource conflict" });
  assert.deepEqual(await body(managementError(missing)), { error: "Resource not found" });
});

test("shared adapter sanitizes unexpected internal errors", async () => {
  const response = managementError(new Error("password=secret SQL stack trace"));
  assert.equal(response.status, 500);
  assert.deepEqual(await body(response), { error: "Internal server error" });
});
