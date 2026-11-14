import assert from "node:assert/strict";
import { before, mock, test } from "node:test";

type Hour = { day: string; openTime: string; closeTime: string; isOpen: boolean; organizationId: string; userId: string | null };

let stored: Hour[] = [];
let members = ["staff-a", "staff-b"];
let failForUser: string | null = null;
let revalidated: string[] = [];
let transactionCalls = 0;
let callbackWritesOutsideTransaction = 0;

const removeRows = (where: { organizationId: string; userId: string | null }) => {
  stored = stored.filter((row) => row.organizationId !== where.organizationId || row.userId !== where.userId);
};

const insertRows = async (data: Hour[]) => {
  const userId = data[0]?.userId ?? null;
  if (userId && failForUser === userId) throw new Error(`write failed for ${userId}`);
  stored.push(...data.map((row) => ({ ...row, userId: row.userId ?? null })));
  return { count: data.length };
};

mock.module("@/lib/db", { namedExports: {
  prisma: {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      transactionCalls++;
      const snapshot = structuredClone(stored);
      const tx = {
        businessHour: {
          deleteMany: async ({ where }: { where: { organizationId: string; userId: string | null } }) => removeRows(where),
          createMany: async ({ data }: { data: Hour[] }) => insertRows(data),
        },
        organizationMember: {
          findMany: async ({ where }: { where: { organizationId: string } }) => {
            assert.equal(where.organizationId, "org-a");
            return members.map((userId) => ({ userId }));
          },
        },
      };
      try {
        return await callback(tx);
      } catch (error) {
        stored = snapshot;
        throw error;
      }
    },
    businessHour: {
      deleteMany: async () => { callbackWritesOutsideTransaction++; },
      createMany: async () => { callbackWritesOutsideTransaction++; },
    },
  },
} });

mock.module("next/cache", { namedExports: {
  revalidatePath: (path: string) => { revalidated.push(path); },
  revalidateTag: () => undefined,
} });

let updateBusinessHours: (organizationId: string, hours: Array<{ day: string; openTime: string; closeTime: string; isOpen: boolean }>) => Promise<unknown>;
before(async () => {
  ({ organizationService: { updateBusinessHours } } = await import("@/lib/services/organization.service"));
});

const monday = (openTime = "09:00", closeTime = "17:00") => ({ day: "MONDAY", openTime, closeTime, isOpen: true });
const reset = () => {
  stored = [
    { ...monday("08:00", "12:00"), organizationId: "org-a", userId: null },
    { ...monday("08:00", "12:00"), organizationId: "org-a", userId: "staff-a" },
    { ...monday("08:00", "12:00"), organizationId: "org-a", userId: "staff-b" },
    { ...monday("10:00", "14:00"), organizationId: "org-other", userId: "staff-a" },
  ];
  members = ["staff-a", "staff-b"];
  failForUser = null;
  revalidated = [];
  transactionCalls = 0;
  callbackWritesOutsideTransaction = 0;
};

test("business-hours replacement writes org and every member in one transaction", async () => {
  reset();
  await updateBusinessHours("org-a", [monday()]);

  assert.equal(transactionCalls, 1);
  assert.equal(callbackWritesOutsideTransaction, 0);
  assert.deepEqual(stored.filter((row) => row.organizationId === "org-a"), [
    { ...monday(), organizationId: "org-a", userId: null },
    { ...monday(), organizationId: "org-a", userId: "staff-a" },
    { ...monday(), organizationId: "org-a", userId: "staff-b" },
  ]);
  assert.deepEqual(stored.filter((row) => row.organizationId === "org-other"), [
    { ...monday("10:00", "14:00"), organizationId: "org-other", userId: "staff-a" },
  ]);
  assert.deepEqual(revalidated, ["/dashboard/settings"]);
});

test("empty hours clears organization and all member schedules", async () => {
  reset();
  const result = await updateBusinessHours("org-a", []);

  assert.deepEqual(result, { count: 0 });
  assert.equal(transactionCalls, 1);
  assert.equal(stored.some((row) => row.organizationId === "org-a"), false);
  assert.equal(stored.some((row) => row.organizationId === "org-other"), true);
  assert.deepEqual(revalidated, ["/dashboard/settings"]);
});

test("failed member write rolls back org and earlier member writes without revalidation", async () => {
  reset();
  const beforeWrite = structuredClone(stored);
  failForUser = "staff-b";

  await assert.rejects(updateBusinessHours("org-a", [monday()]), /write failed for staff-b/);

  assert.equal(transactionCalls, 1);
  assert.deepEqual(stored, beforeWrite);
  assert.deepEqual(revalidated, []);
});
