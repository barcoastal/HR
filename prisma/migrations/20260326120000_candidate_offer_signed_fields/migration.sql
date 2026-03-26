-- AlterTable: add signed offer fields to Candidate
ALTER TABLE "Candidate" ADD COLUMN "offerSignedDocUrl" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "offerSignedAt" TIMESTAMP(3);
