import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync("app/[locale]/dashboard/settings/domains/page.tsx", "utf8");
const locales = ["fa", "en", "ar"] as const;

function valueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

describe("organization domain manager localization", () => {
  it("provides every visible dictionary lookup in Persian, English, and Arabic", () => {
    const keys = [...page.matchAll(/t\("(dashboard\.domains\.[^"]+)"/g)]
      .map((match) => match[1])
      .filter((key): key is string => Boolean(key));
    assert.ok(keys.length > 0, "the manager should expose dictionary-backed copy");

    for (const locale of locales) {
      const dictionary = JSON.parse(readFileSync(`dictionaries/${locale}.json`, "utf8")) as unknown;
      for (const key of keys) {
        const value = valueAtPath(dictionary, key);
        assert.equal(typeof value, "string", `${locale} is missing ${key}`);
        assert.notEqual(value, key, `${locale}.${key} must not fall back to the raw key`);
      }
    }
  });

  it("includes fluent Persian copy for the domain title, explanation, DNS, and automation states", () => {
    const dictionary = JSON.parse(readFileSync("dictionaries/fa.json", "utf8")) as unknown;
    for (const key of [
      "dashboard.domains.title",
      "dashboard.domains.description",
      "dashboard.domains.dnsRecords",
      "dashboard.domains.automationDryRun",
    ]) {
      const value = valueAtPath(dictionary, key);
      assert.equal(typeof value, "string", `Persian translation is missing ${key}`);
      assert.doesNotMatch(String(value), /dashboard\.domains\./);
    }
  });
});
