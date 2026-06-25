# Clean Source Note

The requested clean-source output should be generated from the user's local repository after applying the P41A overlay because the full uploaded source was provided as a RAR archive and this execution environment did not have a working RAR extraction backend.

Use:

```powershell
.\CREATE_CLEAN_SOURCE.ps1
```

The project already includes a clean release workflow from Phase 33. The expected local output is:

```txt
.release\bazar-baz-clean-source
.release\bazar-baz-clean-source.zip
```

The clean source generator intentionally excludes secrets/local artifacts such as:

```txt
.env*
.vercel/
node_modules/
.next/
test-results/
*.dump
*.backup
prisma/dev.db
tsconfig.tsbuildinfo
```
