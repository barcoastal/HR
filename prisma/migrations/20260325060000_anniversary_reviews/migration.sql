-- Add department and anniversary fields to ReviewCycle
ALTER TABLE "ReviewCycle" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "ReviewCycle" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "ReviewCycle" ADD COLUMN "isAnniversary" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "ReviewCycle_departmentId_idx" ON "ReviewCycle"("departmentId");
CREATE INDEX "ReviewCycle_employeeId_idx" ON "ReviewCycle"("employeeId");
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Department review templates
CREATE TABLE "DepartmentReviewTemplate" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Review',
    "selfTemplate" JSONB,
    "managerTemplate" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentReviewTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentReviewTemplate_departmentId_key" ON "DepartmentReviewTemplate"("departmentId");
ALTER TABLE "DepartmentReviewTemplate" ADD CONSTRAINT "DepartmentReviewTemplate_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
