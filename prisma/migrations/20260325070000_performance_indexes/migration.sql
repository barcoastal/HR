-- Performance indexes for 100 concurrent users
CREATE INDEX IF NOT EXISTS "Candidate_recruiterId_idx" ON "Candidate"("recruiterId");
CREATE INDEX IF NOT EXISTS "Candidate_inPipeline_idx" ON "Candidate"("inPipeline");
CREATE INDEX IF NOT EXISTS "StageDocument_stage_idx" ON "StageDocument"("stage");
