-- Preserve internal UserRole authorization while exposing demo-facing role names.
ALTER TABLE "DemoSessionToken"
  ADD COLUMN "demoRole" TEXT;

CREATE INDEX "DemoSessionToken_organizationId_demoRole_expiresAt_idx"
  ON "DemoSessionToken"("organizationId", "demoRole", "expiresAt");
