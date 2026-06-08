# Phase 21 — Local Artifact Delete Manifest

These files/directories were present in the uploaded project ZIP and must not be included in a production/release artifact.

The changed-files overlay ZIP cannot delete files automatically. Remove or keep them only in private local development as appropriate before creating any release artifact.

## Must remove from shared/release artifacts

```txt
.env
prisma/dev.db
test-results/.last-run.json
```

## Review and remove unless intentionally public

```txt
public/myResume.pdf
```

## Always exclude from release artifacts

```txt
.next/
node_modules/
coverage/
test-results/
public/uploads/
uploads/
lib/generated/prisma/
*.zip
*.rar
*.7z
*.pem
*.sqlite
*.db
```

## Validator

Run the release/overlay artifact hygiene validator on a candidate artifact directory before zipping it:

```bash
node scripts/quality/validate-release-artifact.mjs <candidate-directory>
```

A real production/release artifact or changed-files overlay must pass this hygiene validator.
