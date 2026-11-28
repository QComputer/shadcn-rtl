import assert from "node:assert/strict";

export function validateProofRehearsalEnvironment(env) {
  assert.equal(env.NODE_ENV, "test", "NODE_ENV must be test");
  const urls = [env.DATABASE_URL, env.DIRECT_URL].map(value => new URL(value));
  for (const url of urls) {
    assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
    assert.equal(url.hostname, "127.0.0.1", "explicit IPv4 loopback required");
    assert.equal(url.port, "55439");
    assert.equal(url.pathname, "/damoon_migration_gap_rehearsal");
    assert.equal(decodeURIComponent(url.username), "hotel_gap_test");
    assert.equal(url.hash, "");
    assert.ok([...url.searchParams].every(([k,v]) => k === "schema" && v === "public") && url.searchParams.getAll("schema").length <= 1, "unexpected connection parameters");
  }
  assert.equal(urls[0].username, urls[1].username);
  assert.equal(urls[0].password, urls[1].password, "database credentials must match");
  assert.equal(urls[0].hostname, urls[1].hostname);
  assert.equal(urls[0].port, urls[1].port);
  assert.equal(urls[0].pathname, urls[1].pathname);
  return urls[0];
}
