ALTER TABLE "ChecklistItem"
ADD COLUMN "assigneeDepartmentId" TEXT;

ALTER TABLE "EmployeeTask"
ADD COLUMN "assigneeDepartmentId" TEXT,
ADD COLUMN "completedById" TEXT;

CREATE INDEX "ChecklistItem_assigneeDepartmentId_idx" ON "ChecklistItem"("assigneeDepartmentId");
CREATE INDEX "EmployeeTask_assigneeDepartmentId_idx" ON "EmployeeTask"("assigneeDepartmentId");
CREATE INDEX "EmployeeTask_completedById_idx" ON "EmployeeTask"("completedById");

ALTER TABLE "ChecklistItem"
ADD CONSTRAINT "ChecklistItem_assigneeDepartmentId_fkey"
FOREIGN KEY ("assigneeDepartmentId") REFERENCES "Department"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeTask"
ADD CONSTRAINT "EmployeeTask_assigneeDepartmentId_fkey"
FOREIGN KEY ("assigneeDepartmentId") REFERENCES "Department"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeTask"
ADD CONSTRAINT "EmployeeTask_completedById_fkey"
FOREIGN KEY ("completedById") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Legacy per-person custom task containers were treated as global templates.
-- Keep their workflow label while preventing them from being assigned to
-- every future hire by the onboarding resolver.
UPDATE "OnboardingChecklist"
SET "isOverride" = TRUE
WHERE "name" LIKE 'Custom % Tasks'
  AND "departmentId" IS NULL
  AND "jobTitleId" IS NULL;
