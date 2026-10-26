# Vendored SheetJS dependency

`xlsx-0.20.3.tgz` is the unmodified official SheetJS Community Edition 0.20.3
package from https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz.

SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`

SheetJS recommends vendoring to avoid CDN availability affecting installation:
https://docs.sheetjs.com/docs/getting-started/installation/nodejs/#vendoring

This is a staging copy of `../../vendor/xlsx-0.20.3.tgz`. Keep both copies
byte-identical. The RunFlare-generated Dockerfile uses
`COPY package*.json prism[a] yarn.loc[k] /app/` before dependency installation.
Docker copies the contents of `prisma`, so this file becomes
`/app/vendor/xlsx-0.20.3.tgz`, matching the dependency's `file:vendor/...` path.
The root `vendor` copy supplies that same path in a normal checkout and after
the later full-source copy. The archive includes the upstream license files.

When updating SheetJS, download the official release, review its version and
license, record its hash here, and regenerate `pnpm-lock.yaml` using pnpm 10.15.0.
