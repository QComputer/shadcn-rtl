#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

function contains(rel, pattern, name) {
  const source = read(rel);
  add(name, pattern.test(source), rel);
}

const orderService = read("lib/services/order.service.ts");
const cartService = read("lib/services/cart.service.ts");
const publicOrderRoute = read("app/api/public/orders/[orderNumber]/route.ts");
const orderPaymentRoute = read("app/api/orders/[id]/payment/route.ts");
const ordersRoute = read("app/api/orders/route.ts");

add(
  "delivery fee uses OrganizationSettings.deliveryFee",
  /settings\?\.deliveryFee\s*\?\?\s*0/.test(orderService) && /settings\?\.deliveryFee\s*\?\?\s*0/.test(cartService),
  "order/cart delivery fee",
);

add(
  "order number generation avoids Math.random",
  /generateUniqueOrderNumber\(tx: Prisma\.TransactionClient\)/.test(orderService) && !/Math\.random\(/.test(orderService),
  "lib/services/order.service.ts",
);

add(
  "public tracking token generation has uniqueness retry",
  /generateUniquePublicTrackingToken\(tx: Prisma\.TransactionClient\)/.test(orderService) && /where:\s*\{ publicTrackingToken \}/.test(orderService),
  "lib/services/order.service.ts",
);

add(
  "registered checkout runs inside transaction",
  /async create\([\s\S]*?const order = await prisma\.\$transaction\(async \(tx\) => \{/.test(orderService),
  "registered checkout transaction",
);

add(
  "guest checkout runs inside transaction",
  /async createForGuest\([\s\S]*?const order = await prisma\.\$transaction\(async \(tx\) => \{/.test(orderService),
  "guest checkout transaction",
);

contains(
  "lib/services/order.service.ts",
  /private async decrementOrderInventory[\s\S]*InventoryMovementReason\.ORDER_CREATED[\s\S]*this\.decrementOrderInventory\(tx,/,
  "checkout decrements inventory and records movement",
);

contains(
  "lib/services/order.service.ts",
  /createPaymentEvent\(tx,[\s\S]*Payment initialized during order creation/,
  "registered checkout creates payment event",
);

contains(
  "lib/services/order.service.ts",
  /createPaymentEvent\(tx,[\s\S]*Payment initialized during guest order creation/,
  "guest checkout creates payment event",
);

contains(
  "lib/services/order.service.ts",
  /private async restoreOrderInventory[\s\S]*ORDER_CANCELLED[\s\S]*ORDER_REFUNDED[\s\S]*this\.restoreOrderInventory\(tx,/,
  "cancel/refund inventory restore guard exists",
);

add(
  "public tracking route strips publicTrackingToken from response",
  /publicTrackingToken:\s*_publicTrackingToken/.test(publicOrderRoute),
  "app/api/public/orders/[orderNumber]/route.ts",
);

add(
  "public order payment mutation remains disabled",
  /export\s+async\s+function\s+PUT\s*\(\)\s*\{[\s\S]*status:\s*405/.test(publicOrderRoute),
  "app/api/public/orders/[orderNumber]/route.ts",
);

add(
  "authenticated payment mutation requires admin or manager order access",
  /requireOrderAccess\(session,\s*id,\s*\["ADMIN",\s*"MANAGER"\]\)/.test(orderPaymentRoute),
  "app/api/orders/[id]/payment/route.ts",
);

add(
  "checkout maps insufficient inventory to 409",
  /Insufficient inventory/.test(ordersRoute) && /return 409/.test(ordersRoute),
  "app/api/orders/route.ts",
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(`Commerce correctness validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}
console.log("Commerce correctness validation passed.");
