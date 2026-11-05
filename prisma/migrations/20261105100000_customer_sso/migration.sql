-- Additive customer SSO. Existing phone sessions and club memberships are unchanged.
CREATE TABLE "CustomerSsoTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketDigest" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceSessionId" TEXT NOT NULL,
  "sourceOrganizationId" TEXT NOT NULL,
  "targetOrganizationId" TEXT NOT NULL,
  "targetOrigin" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerSsoTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerSsoTicket_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "CustomerPhoneSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerSsoTicket_sourceOrganizationId_fkey" FOREIGN KEY ("sourceOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerSsoTicket_targetOrganizationId_fkey" FOREIGN KEY ("targetOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerSsoTicket_ticketDigest_key" ON "CustomerSsoTicket"("ticketDigest");
CREATE INDEX "CustomerSsoTicket_expiresAt_idx" ON "CustomerSsoTicket"("expiresAt");
CREATE INDEX "CustomerSsoTicket_sourceSessionId_idx" ON "CustomerSsoTicket"("sourceSessionId");
CREATE INDEX "CustomerSsoTicket_userId_idx" ON "CustomerSsoTicket"("userId");
CREATE INDEX "CustomerSsoTicket_sourceOrganizationId_idx" ON "CustomerSsoTicket"("sourceOrganizationId");
CREATE INDEX "CustomerSsoTicket_targetOrganizationId_idx" ON "CustomerSsoTicket"("targetOrganizationId");
