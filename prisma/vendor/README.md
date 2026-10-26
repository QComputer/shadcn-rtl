# Vendored SheetJS dependency

`xlsx-0.20.3.tgz` is the unmodified official SheetJS Community Edition 0.20.3
package from https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz.

SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`

SheetJS recommends vendoring to avoid CDN availability affecting installation:
https://docs.sheetjs.com/docs/getting-started/installation/nodejs/#vendoring

The archive is stored under `prisma/vendor` because the RunFlare-generated
Dockerfile copies `package*.json`, `prisma`, and `yarn.lock` before its dependency
installation step. A root `vendor` directory is unavailable at that step.
Both npm and pnpm resolve the same local archive through `package.json`.
The archive includes the upstream license files.

When updating SheetJS, download the official release, review its version and
license, record its hash here, and regenerate `pnpm-lock.yaml` using pnpm 10.15.0.
