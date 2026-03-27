-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add email targeting fields to FeedPost
ALTER TABLE "FeedPost" ADD COLUMN "notifyViaEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FeedPost" ADD COLUMN "emailTargetType" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "FeedPost" ADD COLUMN "emailTargetIds" TEXT;

-- CreateIndex
CREATE INDEX "NotificationRule_action_idx" ON "NotificationRule"("action");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRule_action_channel_recipient_key" ON "NotificationRule"("action", "channel", "recipient");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_employeeId_key" ON "NotificationRecipient"("employeeId");

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
