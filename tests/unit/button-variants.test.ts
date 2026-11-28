import assert from "node:assert/strict"
import test from "node:test"

import { buttonVariants } from "../../components/ui/button-variants"

test("button variant classes stay server-safe and preserve their public styling", () => {
  assert.match(buttonVariants(), /bg-primary text-primary-foreground/)
  assert.match(buttonVariants({ variant: "outline" }), /border-border bg-background/)
  assert.match(buttonVariants({ variant: "secondary", size: "sm" }), /bg-secondary text-secondary-foreground/)
  assert.match(buttonVariants({ variant: "destructive", size: "lg" }), /text-destructive/)
  assert.match(buttonVariants({ className: "rtl:gap-2" }), /rtl:gap-2/)
})
