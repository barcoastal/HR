-- Add new candidate statuses
ALTER TYPE "CandidateStatus" ADD VALUE 'PRE_ONBOARDING';
ALTER TYPE "CandidateStatus" ADD VALUE 'ONBOARDING';
ALTER TYPE "CandidateStatus" ADD VALUE 'OFFBOARDING';

-- Create StageDocument table
CREATE TABLE "StageDocument" (
    "id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageDocument_pkey" PRIMARY KEY ("id")
);
