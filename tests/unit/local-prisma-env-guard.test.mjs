import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  runGuardedCommand,
  validateLocalPrismaEnvironment,
} from "../../scripts/db/guard-local-prisma-env.mjs";

const local = "postgresql://postgres:postgres@localhost:55549/bazar_baz_local?schema=public";
const remote = "postgresql://user:password@ep-little-river-aifwxtf7.c-4.us-east-1.aws.neon.tech/neondb";

describe("local Prisma environment guard", () => {
  it("accepts matching DATABASE_URL and DIRECT_URL on the expected local port", () => {
    assert.deepEqual(validateLocalPrismaEnvironment({
      DATABASE_URL: local,
      DIRECT_URL: local,
      LOCAL_PRISMA_EXPECTED_PORT: "55549",
    }), { ok: true, errors: [] });
  });

  it("refuses DATABASE_URL localhost with DIRECT_URL remote before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: local,
        DIRECT_URL: remote,
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses DATABASE_URL remote with DIRECT_URL localhost before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: remote,
        DIRECT_URL: local,
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses local/local different ports before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:55550/bazar_baz_local",
        DIRECT_URL: "postgresql://postgres:postgres@localhost:55551/bazar_baz_local",
        LOCAL_PRISMA_EXPECTED_PORT: "55550",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses local/local different databases before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:55550/db_a",
        DIRECT_URL: "postgresql://postgres:postgres@localhost:55550/db_b",
        LOCAL_PRISMA_EXPECTED_PORT: "55550",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses missing DATABASE_URL before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DIRECT_URL: local,
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses missing DIRECT_URL before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: local,
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses malformed DATABASE_URL before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: "not-a-url",
        DIRECT_URL: local,
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses malformed DIRECT_URL before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: local,
        DIRECT_URL: "not-a-url",
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });

  it("refuses expected-port mismatch before spawning Prisma", async () => {
    let spawned = false;
    const code = await runGuardedCommand(
      ["--", "pnpm", "exec", "prisma", "migrate", "deploy"],
      {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:55550/bazar_baz_local",
        DIRECT_URL: "postgresql://postgres:postgres@localhost:55550/bazar_baz_local",
        LOCAL_PRISMA_EXPECTED_PORT: "55549",
      },
      () => {
        spawned = true;
        throw new Error("spawn must not be invoked");
      },
    );

    assert.equal(code, 1);
    assert.equal(spawned, false);
  });
});
