#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function add(name, ok, detail = "") {
  checks.push({ name, ok, detail });
}

const driverRoute = read("app/api/orders/[id]/driver/route.ts");
add(
  "driver order GET is read-only / method-not-allowed",
  /export async function GET\s*\([^)]*\)\s*{[\s\S]*status:\s*405/.test(driverRoute) &&
    !/export const GET\s*=\s*POST/.test(driverRoute) &&
    !/return\s+POST\s*\(/.test(driverRoute),
  "app/api/orders/[id]/driver/route.ts",
);

const openRoute = read("app/api/organizations/open/route.ts");
const getBlock = openRoute.match(/export async function GET[\s\S]*?\n}\n\nexport async function POST/);
add(
  "organization open GET does not mutate state",
  Boolean(getBlock) && !/\.update\s*\(/.test(getBlock[0]) && /findUnique\s*\(/.test(getBlock[0]),
  "app/api/organizations/open/route.ts",
);

const registerRoute = read("app/api/auth/register/route.ts");
add(
  "member application is awaited",
  /await\s+organizationService\.applyAsMember\s*\(/.test(registerRoute),
  "app/api/auth/register/route.ts",
);

const organizationRegisterRoute = read("app/api/auth/register/organization/route.ts");
add(
  "organization registration is transactional",
  /prisma\.\$transaction\s*\(/.test(organizationRegisterRoute) &&
    /tx\.organization\.create/.test(organizationRegisterRoute) &&
    /tx\.organizationMember\.create/.test(organizationRegisterRoute),
  "app/api/auth/register/organization/route.ts",
);

const organizationService = read("lib/services/organization.service.ts");
add(
  "organization service create/createByUser use transactions",
  (organizationService.match(/prisma\.\$transaction\s*\(/g) || []).length >= 2,
  "lib/services/organization.service.ts",
);
add(
  "addMember rejects missing organization instead of using fallback slug",
  /throw new Error\("Organization not found"\)/.test(organizationService) &&
    !/organizationSlug:\s*org\?\.slug\s*\|\|\s*["']slug["']/.test(organizationService),
  "lib/services/organization.service.ts",
);
add(
  "staff business hour deletion is organization scoped",
  /where:\s*{\s*organizationId,\s*userId\s*}/.test(organizationService),
  "lib/services/organization.service.ts",
);
add(
  "business-hour fanout awaits all staff updates",
  /await\s+Promise\.all\s*\(/.test(organizationService),
  "lib/services/organization.service.ts",
);

const orderService = read("lib/services/order.service.ts");
add(
  "order delivery fee uses deliveryFee not deliveryRadius magic value",
  /settings\?\.deliveryFee\s*\?\?\s*0/.test(orderService) &&
    !/settings\?\.deliveryRadius\s*\?\s*20000\s*:\s*0/.test(orderService),
  "lib/services/order.service.ts",
);
add(
  "driver order listing scopes assigned orders to current driver",
  /const assignedWhere:[\s\S]*driverId/.test(orderService) &&
    /const orderWhere:[\s\S]*assignedWhere[\s\S]*availableWhere/.test(orderService) &&
    /prisma\.order\.count\(\{ where: orderWhere \}\)/.test(orderService),
  "lib/services/order.service.ts",
);
add(
  "driver order status filter rejects pseudo statuses such as DENIED",
  /Invalid order status filter/.test(orderService) && !/"DENIED"/.test(orderService),
  "lib/services/order.service.ts",
);

const cartService = read("lib/services/cart.service.ts");
add(
  "cart summary delivery fee uses deliveryFee not deliveryRadius magic value",
  /settings\?\.deliveryFee\s*\?\?\s*0/.test(cartService) &&
    !/settings\?\.deliveryRadius\s*\?\s*20000\s*:\s*0/.test(cartService),
  "lib/services/cart.service.ts",
);

const apiGuards = read("lib/api-guards.ts");
add(
  "generic jsonError responses do not expose raw 500 error messages",
  /status >= 500[\s\S]*\? fallback/.test(apiGuards) &&
    !/error instanceof Error \? error\.message \|\| fallback : fallback/.test(apiGuards),
  "lib/api-guards.ts",
);

const validators = read("lib/validators/index.ts");
add(
  "order filters and status types include CANCELLED",
  /updateOrderStatusSchema[\s\S]*CANCELLED/.test(validators) &&
    /orderFilterSchema[\s\S]*CANCELLED/.test(validators),
  "lib/validators/index.ts",
);
add(
  "estimated-end-time updates require ISO datetime validation",
  /estimatedEndTime:\s*z\.string\(\)\.datetime/.test(validators),
  "lib/validators/index.ts",
);
add(
  "organization settings validator accepts deliveryFee",
  /deliveryFee:\s*z\.number\(\)\.nonnegative\(\)\.optional\(\)/.test(validators),
  "lib/validators/index.ts",
);

const publicTypes = read("lib/types.ts");
add(
  "public OrderStatus union includes CANCELLED",
  /export type OrderStatus[\s\S]*"CANCELLED"/.test(publicTypes),
  "lib/types.ts",
);

console.table(checks);
const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("P20 API/service safety validation failed.", failed);
  process.exit(1);
}

console.log("P20 API/service safety validation passed.");
