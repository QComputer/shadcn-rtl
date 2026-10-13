// CI-only artwork for the third, deliberately unrelated synthetic tenant.
// Run before `next build`: Next.js inventories public files at build time.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { deflateSync } from "node:zlib";

const root = resolve("public/brand/tenants");
export const genericAssetRoot = "/brand/tenants/__pwa-ci-generic";
export const genericAssetDirectory = resolve(root, "__pwa-ci-generic");
if (!genericAssetDirectory.startsWith(`${root}${sep}`)) throw new Error("CI asset path escaped its fixture root");

function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}

function png(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + size * 3);
  for (let pixel = 0; pixel < size; pixel += 1) Buffer.from([31, 145, 110]).copy(row, 1 + pixel * 3);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(genericAssetDirectory, { recursive: true });
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["maskable-192.png", 192], ["maskable-512.png", 512], ["apple-180.png", 180]]) {
  writeFileSync(resolve(genericAssetDirectory, name), png(size));
}
