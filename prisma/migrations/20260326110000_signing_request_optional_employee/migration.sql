-- AlterTable: make employeeId optional, add candidate support
ALTER TABLE "SigningRequest" ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "SigningRequest" ADD COLUMN "candidateId" TEXT;
ALTER TABLE "SigningRequest" ADD COLUMN "signerName" TEXT;
ALTER TABLE "SigningRequest" ADD COLUMN "signerEmail" TEXT;

-- CreateIndex
CREATE INDEX "SigningRequest_candidateId_idx" ON "SigningRequest"("candidateId");

-- AddForeignKey
ALTER TABLE "SigningRequest" ADD CONSTRAINT "SigningRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
