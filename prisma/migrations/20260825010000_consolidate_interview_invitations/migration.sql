ALTER TABLE "Interview"
ADD COLUMN "interviewerId" TEXT,
ADD COLUMN "calendarOrganizerUserId" TEXT;

CREATE INDEX "Interview_interviewerId_idx" ON "Interview"("interviewerId");
CREATE INDEX "Interview_calendarOrganizerUserId_idx" ON "Interview"("calendarOrganizerUserId");

ALTER TABLE "Interview"
ADD CONSTRAINT "Interview_interviewerId_fkey"
FOREIGN KEY ("interviewerId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Interview"
ADD CONSTRAINT "Interview_calendarOrganizerUserId_fkey"
FOREIGN KEY ("calendarOrganizerUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
