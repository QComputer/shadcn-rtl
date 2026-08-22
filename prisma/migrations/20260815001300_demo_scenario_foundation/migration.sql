-- Additive guided demo scenario foundation.
CREATE TABLE "DemoScenario" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoScenario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoScenarioStep" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "role" TEXT NOT NULL,
    "action" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoScenarioStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoProgress" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "sessionId" TEXT,
    "demoRole" TEXT,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoScenario_publicId_key" ON "DemoScenario"("publicId");
CREATE UNIQUE INDEX "DemoScenario_organizationId_key_key" ON "DemoScenario"("organizationId", "key");
CREATE INDEX "DemoScenario_organizationId_isActive_idx" ON "DemoScenario"("organizationId", "isActive");

CREATE UNIQUE INDEX "DemoScenarioStep_publicId_key" ON "DemoScenarioStep"("publicId");
CREATE UNIQUE INDEX "DemoScenarioStep_scenarioId_key_key" ON "DemoScenarioStep"("scenarioId", "key");
CREATE INDEX "DemoScenarioStep_scenarioId_sortOrder_idx" ON "DemoScenarioStep"("scenarioId", "sortOrder");

CREATE UNIQUE INDEX "DemoProgress_publicId_key" ON "DemoProgress"("publicId");
CREATE UNIQUE INDEX "DemoProgress_scenarioId_stepId_sessionId_key" ON "DemoProgress"("scenarioId", "stepId", "sessionId");
CREATE INDEX "DemoProgress_organizationId_scenarioId_idx" ON "DemoProgress"("organizationId", "scenarioId");
CREATE INDEX "DemoProgress_sessionId_idx" ON "DemoProgress"("sessionId");

ALTER TABLE "DemoScenario"
  ADD CONSTRAINT "DemoScenario_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DemoScenarioStep"
  ADD CONSTRAINT "DemoScenarioStep_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "DemoScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DemoProgress"
  ADD CONSTRAINT "DemoProgress_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DemoProgress_scenarioId_fkey"
  FOREIGN KEY ("scenarioId") REFERENCES "DemoScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DemoProgress_stepId_fkey"
  FOREIGN KEY ("stepId") REFERENCES "DemoScenarioStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
