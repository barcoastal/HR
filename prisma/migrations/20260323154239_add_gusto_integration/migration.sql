-- CreateTable
CREATE TABLE "GustoConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "webhookSubId" TEXT,
    "webhookSecret" TEXT,
    "connectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GustoConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GustoConnection_companyId_key" ON "GustoConnection"("companyId");

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "gustoEmployeeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_gustoEmployeeId_key" ON "Employee"("gustoEmployeeId");
