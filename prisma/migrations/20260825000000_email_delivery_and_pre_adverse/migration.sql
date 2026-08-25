ALTER TABLE "Candidate"
ADD COLUMN "preAdverseActionStatus" TEXT,
ADD COLUMN "preAdverseActionSentAt" TIMESTAMP(3),
ADD COLUMN "preAdverseActionDueAt" TIMESTAMP(3),
ADD COLUMN "preAdverseActionProviderId" TEXT,
ADD COLUMN "preAdverseActionError" TEXT;

CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "senderEmployeeId" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDelivery_providerId_key" ON "EmailDelivery"("providerId");
CREATE INDEX "EmailDelivery_status_idx" ON "EmailDelivery"("status");
CREATE INDEX "EmailDelivery_senderEmployeeId_idx" ON "EmailDelivery"("senderEmployeeId");
CREATE INDEX "EmailDelivery_contextType_contextId_idx" ON "EmailDelivery"("contextType", "contextId");
CREATE INDEX "EmailDelivery_createdAt_idx" ON "EmailDelivery"("createdAt");

ALTER TABLE "EmailDelivery"
ADD CONSTRAINT "EmailDelivery_senderEmployeeId_fkey"
FOREIGN KEY ("senderEmployeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
