# PHASE 59 Hotfix — Button asChild Compatibility

This hotfix updates `app/[locale]/domain-not-configured/page.tsx` to avoid the `Button asChild` API.

The local Bazar Baz `components/ui/button.tsx` exports `buttonVariants`, but its `Button` component does not accept `asChild`. The page now renders the `next/link` directly with `buttonVariants()`.

Validation target:

```powershell
pnpm typecheck
pnpm lint
pnpm build
```
