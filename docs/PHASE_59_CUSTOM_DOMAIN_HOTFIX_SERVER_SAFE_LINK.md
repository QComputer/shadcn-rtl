# PHASE 59 Hotfix — Server-Safe Domain Not Configured Page

This hotfix updates `app/[locale]/domain-not-configured/page.tsx` after the build failed during prerendering:

```txt
Attempted to call buttonVariants() from the server but buttonVariants is on the client.
```

Root cause:

- `components/ui/button.tsx` is a Client Component in this project.
- Importing/calling `buttonVariants()` from the server-rendered route page makes Next.js 16 fail prerendering.

Fix:

- Remove the `Button` / `buttonVariants` import entirely.
- Render the `next/link` with server-safe Tailwind classes.
- Keep the route as a Server Component.

Validation target:

```powershell
pnpm typecheck
pnpm build
```

Notes:

- This hotfix only addresses the custom-domain page build blocker.
- If `pnpm lint` still fails, inspect unrelated pre-existing lint errors and ensure extracted overlay folders are not left inside the project root.
