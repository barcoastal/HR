-- Read-only reporting access for Evgeny (Bar-approved 2026-10-06).
-- Creates schema + views (no secrets) and a SELECT-only role.
-- Safe to re-run.

CREATE SCHEMA IF NOT EXISTS reporting;

-- Employees: tenure / start-end dates (no emergency contacts, addresses, bio)
CREATE OR REPLACE VIEW reporting.employees AS
SELECT
  e.id,
  e."firstName",
  e."preferredName",
  e."lastName",
  e.email,
  e."jobTitle",
  e.status,
  e."startDate",
  e."endDate",
  e."anniversaryDate",
  e."departmentId",
  d.name AS "departmentName",
  e."managerId",
  m."firstName" AS "managerFirstName",
  m."lastName" AS "managerLastName",
  e."requiresTraining",
  e."archivedAt",
  e."rehireEligible",
  e."createdAt",
  e."updatedAt"
FROM "Employee" e
LEFT JOIN "Department" d ON d.id = e."departmentId"
LEFT JOIN "Employee" m ON m.id = e."managerId";

-- Candidates + pipeline stage
CREATE OR REPLACE VIEW reporting.candidates AS
SELECT
  c.id,
  c."firstName",
  c."lastName",
  c.email,
  c.phone,
  c.status,
  c."stageId",
  c."inPipeline",
  c.source,
  c."jobAppliedTo",
  c."positionId",
  p.title AS "positionTitle",
  c."recruiterId",
  r."firstName" AS "recruiterFirstName",
  r."lastName" AS "recruiterLastName",
  c."managerId",
  c."appliedAt",
  c."hiredAt",
  c."hourlyRate",
  c."costOfHire",
  c."backgroundCheckStatus",
  c."backgroundCheckDate",
  c."offerSentAt",
  c."offerSignedAt",
  c."doNotCall",
  c."applicationCount",
  c."createdAt",
  c."updatedAt"
FROM "Candidate" c
LEFT JOIN "Position" p ON p.id = c."positionId"
LEFT JOIN "Employee" r ON r.id = c."recruiterId";

-- Applications with stage history JSON (stage dates)
CREATE OR REPLACE VIEW reporting.candidate_applications AS
SELECT
  a.id,
  a."candidateId",
  c."firstName" AS "candidateFirstName",
  c."lastName" AS "candidateLastName",
  c.email AS "candidateEmail",
  a."positionId",
  a."positionName",
  a.status,
  a.source,
  a."appliedAt",
  a."stageHistory",
  a."createdAt",
  a."updatedAt"
FROM "CandidateApplication" a
JOIN "Candidate" c ON c.id = a."candidateId";

CREATE OR REPLACE VIEW reporting.positions AS
SELECT
  p.id,
  p.title,
  p."departmentId",
  d.name AS "departmentName",
  p.location,
  p.type,
  p.status,
  p.published,
  p."createdAt"
FROM "Position" p
LEFT JOIN "Department" d ON d.id = p."departmentId";

CREATE OR REPLACE VIEW reporting.departments AS
SELECT
  id,
  name,
  "parentDepartmentId",
  "createdAt",
  "updatedAt"
FROM "Department";

CREATE OR REPLACE VIEW reporting.interviews AS
SELECT
  i.id,
  i."candidateId",
  c."firstName" AS "candidateFirstName",
  c."lastName" AS "candidateLastName",
  i."positionId",
  p.title AS "positionTitle",
  i."interviewerId",
  i."scheduledAt",
  i.duration,
  i.type,
  i.status,
  i."createdAt"
FROM "Interview" i
LEFT JOIN "Candidate" c ON c.id = i."candidateId"
LEFT JOIN "Position" p ON p.id = i."positionId";

-- Role: password set by the setup script (not hardcoded here). The password is
-- (re)applied on every run so it always matches the saved connection details.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reporting_readonly') THEN
    CREATE ROLE reporting_readonly LOGIN PASSWORD 'REPLACE_ME';
  ELSE
    ALTER ROLE reporting_readonly WITH LOGIN PASSWORD 'REPLACE_ME';
  END IF;
END $$;

GRANT CONNECT ON DATABASE railway TO reporting_readonly;
GRANT USAGE ON SCHEMA reporting TO reporting_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO reporting_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO reporting_readonly;

-- Explicitly no access to public app tables / secrets
REVOKE ALL ON SCHEMA public FROM reporting_readonly;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM reporting_readonly;
