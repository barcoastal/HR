import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { IS_SANDBOX } from "@/lib/sandbox";
import bcrypt from "bcryptjs";

const CRON_SECRET = process.env.CRON_SECRET || "";
const DEMO_PASSWORD = "sandbox123";

/**
 * GET/POST /api/sandbox/reset?secret=<CRON_SECRET>
 *
 * Wipes the sandbox database and reseeds demo data. Only works when
 * SANDBOX_MODE=1 — on production this route is a hard 404 regardless of
 * the secret, so it can never touch real data. Wire it to a Railway cron
 * for nightly resets, or hit it manually after a messy testing session.
 */
export async function GET(request: Request) {
  return reset(request);
}
export async function POST(request: Request) {
  return reset(request);
}

async function reset(request: Request) {
  if (!IS_SANDBOX) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  if (!CRON_SECRET || url.searchParams.get("secret") !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await wipe();
  const summary = await seed();
  return NextResponse.json({ success: true, ...summary });
}

async function wipe() {
  // Children before parents. Sequential to keep FK ordering obvious.
  await db.signingRequest.deleteMany();
  await db.employeeTask.deleteMany();
  await db.checklistOverrideExclusion.deleteMany();
  await db.checklistItem.deleteMany();
  await db.onboardingChecklist.deleteMany();
  await db.interview.deleteMany();
  await db.candidateApplication.deleteMany();
  await db.positionBoardPosting.deleteMany();
  await db.candidate.deleteMany();
  await db.positionDocument.deleteMany();
  await db.position.deleteMany();
  await db.stageDocument.deleteMany();
  await db.review.deleteMany();
  await db.reviewCycle.deleteMany();
  await db.departmentReviewTemplate.deleteMany();
  await db.feedReaction.deleteMany();
  await db.feedComment.deleteMany();
  await db.feedPollVote.deleteMany();
  await db.feedPollOption.deleteMany();
  await db.feedPoll.deleteMany();
  await db.postAttachment.deleteMany();
  await db.eventAttendance.deleteMany();
  await db.feedPost.deleteMany();
  await db.timeOffRequest.deleteMany();
  await db.timeOffBalance.deleteMany();
  await db.timeOffPolicy.deleteMany();
  await db.clubMember.deleteMany();
  await db.club.deleteMany();
  await db.pulseResponse.deleteMany();
  await db.pulseSurvey.deleteMany();
  await db.anonFeedback.deleteMany();
  await db.emergencyAlert.deleteMany();
  await db.notification.deleteMany();
  await db.notificationRecipient.deleteMany();
  await db.auditLog.deleteMany();
  await db.document.deleteMany();
  await db.hRNote.deleteMany();
  await db.platformCostEntry.deleteMany();
  await db.platformSyncLog.deleteMany();
  await db.recruitmentPlatform.deleteMany();
  await db.oAuthState.deleteMany();
  await db.user.deleteMany();
  await db.employee.deleteMany();
  await db.team.deleteMany();
  await db.jobTitle.deleteMany();
  await db.department.deleteMany();
  await db.emailTemplate.deleteMany();
  await db.companySettings.deleteMany();
}

async function seed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number, hour = 14) => {
    const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // Departments
  const [sales, legal, marketing, it] = await Promise.all(
    ["Sales", "Legal", "Marketing", "IT"].map((name) =>
      db.department.create({ data: { name } })
    )
  );

  // Employees
  const alex = await db.employee.create({
    data: {
      firstName: "Alex", lastName: "Admin", email: "admin@sandbox.local",
      jobTitle: "Head of People", departmentId: it.id, startDate: daysAgo(700), status: "ACTIVE",
    },
  });
  const hannah = await db.employee.create({
    data: {
      firstName: "Hannah", lastName: "Recruiter", email: "hr@sandbox.local",
      jobTitle: "HR Manager", departmentId: it.id, startDate: daysAgo(500), status: "ACTIVE",
    },
  });
  const mike = await db.employee.create({
    data: {
      firstName: "Mike", lastName: "Manager", email: "manager@sandbox.local",
      jobTitle: "Sales Manager", departmentId: sales.id, startDate: daysAgo(600), status: "ACTIVE",
    },
  });
  const emma = await db.employee.create({
    data: {
      firstName: "Emma", lastName: "Employee", email: "employee@sandbox.local",
      jobTitle: "Sales Representative", departmentId: sales.id, managerId: mike.id,
      startDate: daysAgo(200), status: "ACTIVE",
    },
  });
  const olivia = await db.employee.create({
    data: {
      firstName: "Olivia", lastName: "Newhire", email: "olivia@sandbox.local",
      jobTitle: "Sales Representative", departmentId: sales.id, managerId: mike.id,
      startDate: daysAgo(3), status: "ONBOARDING",
    },
  });
  await db.employee.create({
    data: {
      firstName: "Peter", lastName: "Preboard", email: "peter@sandbox.local",
      jobTitle: "Sales Representative", departmentId: sales.id, managerId: mike.id,
      startDate: daysAhead(7), status: "PRE_ONBOARDING",
    },
  });
  await db.employee.create({
    data: {
      firstName: "Dana", lastName: "Marketer", email: "dana@sandbox.local",
      jobTitle: "Marketing Coordinator", departmentId: marketing.id,
      startDate: daysAgo(350), status: "ACTIVE",
    },
  });

  // Demo logins — username goes in the User.email field (credentials provider
  // looks usernames up there).
  await db.user.createMany({
    data: [
      { email: "admin", passwordHash, role: "SUPER_ADMIN", employeeId: alex.id },
      { email: "hr", passwordHash, role: "HR", employeeId: hannah.id },
      { email: "manager", passwordHash, role: "MANAGER", employeeId: mike.id },
      { email: "employee", passwordHash, role: "EMPLOYEE", employeeId: emma.id },
    ],
  });

  // Company settings — Hannah is a recruiter
  await db.companySettings.create({
    data: {
      id: "singleton",
      companyName: "CALATRAVA Sandbox",
      recruiterIds: JSON.stringify([hannah.id]),
    },
  });

  // Onboarding checklists
  const onboarding = await db.onboardingChecklist.create({
    data: { name: "Company Onboarding", type: "ONBOARDING" },
  });
  const onboardingItems = await Promise.all(
    [
      { title: "Welcome packet & paperwork", description: "Complete W-4 and direct deposit forms.", dueDay: 1 },
      { title: "IT setup", description: "Laptop, email, and system access.", dueDay: 1 },
      { title: "Meet your manager", description: "Intro 1:1 with your direct manager.", dueDay: 2 },
      { title: "Read the employee handbook", description: "Review and acknowledge the handbook.", dueDay: 5 },
    ].map((item, i) =>
      db.checklistItem.create({
        data: { checklistId: onboarding.id, order: i, ...item },
      })
    )
  );
  const preOnboarding = await db.onboardingChecklist.create({
    data: { name: "Sales Pre-Onboarding", type: "PRE_ONBOARDING", departmentId: sales.id },
  });
  await db.checklistItem.create({
    data: { checklistId: preOnboarding.id, order: 0, title: "Offer letter signed", dueDay: 1 },
  });
  await db.checklistItem.create({
    data: { checklistId: preOnboarding.id, order: 1, title: "Background check consent", dueDay: 2 },
  });

  // Olivia is mid-onboarding: first two tasks done, rest pending
  await Promise.all(
    onboardingItems.map((item, i) =>
      db.employeeTask.create({
        data: {
          employeeId: olivia.id,
          checklistItemId: item.id,
          title: item.title,
          description: item.description,
          status: i < 2 ? "DONE" : "PENDING",
          completedAt: i < 2 ? daysAgo(1) : null,
        },
      })
    )
  );

  // Positions
  const salesRep = await db.position.create({
    data: {
      title: "Sales Representative", departmentId: sales.id, status: "OPEN", published: true,
      description: "Drive outbound sales for our debt-settlement programs.",
      requirements: "1+ years sales experience. Strong phone presence.",
      salary: "$55,000 - $75,000 + commission", location: "Fort Lauderdale, FL", type: "Full-time",
    },
  });
  const paralegal = await db.position.create({
    data: {
      title: "Corporate Paralegal", departmentId: legal.id, status: "OPEN", published: true,
      description: "Support litigation and corporate matters.",
      requirements: "Paralegal certificate. 2+ years experience.",
      salary: "$60,000 - $70,000", location: "Fort Lauderdale, FL", type: "Full-time",
    },
  });
  const marketer = await db.position.create({
    data: {
      title: "Marketing Coordinator", departmentId: marketing.id, status: "OPEN",
      description: "Run campaigns across paid and organic channels.",
      requirements: "Google Ads and analytics experience.",
      salary: "$50,000 - $60,000", location: "Remote", type: "Full-time",
    },
  });
  await db.position.create({
    data: { title: "Sr. Account Executive", departmentId: sales.id, status: "FILLED" },
  });

  // Fake published board posting so the job-boards panel has content
  await db.positionBoardPosting.create({
    data: { positionId: salesRep.id, board: "BREEZY", status: "PUBLISHED", externalId: "sandbox-demo" },
  });

  // Candidates across every stage
  const candidateSeed: {
    firstName: string; lastName: string; status:
      | "NEW" | "CONTACTED" | "SCREENING" | "INTERVIEW" | "OFFER"
      | "BACKGROUND_CHECK" | "HIRED" | "REJECTED";
    positionId: string; source: string; skills: string[]; recruiter?: boolean;
  }[] = [
    { firstName: "James", lastName: "Wilson", status: "NEW", positionId: salesRep.id, source: "Indeed", skills: ["Cold Calling", "CRM"] },
    { firstName: "Maria", lastName: "Garcia", status: "NEW", positionId: salesRep.id, source: "LinkedIn", skills: ["B2B Sales"], recruiter: true },
    { firstName: "Robert", lastName: "Chen", status: "NEW", positionId: paralegal.id, source: "Indeed", skills: ["Litigation Support"] },
    { firstName: "Ashley", lastName: "Brown", status: "CONTACTED", positionId: salesRep.id, source: "Indeed", skills: ["Inside Sales"], recruiter: true },
    { firstName: "David", lastName: "Lee", status: "CONTACTED", positionId: marketer.id, source: "Referral", skills: ["Google Ads", "SEO"] },
    { firstName: "Jessica", lastName: "Taylor", status: "SCREENING", positionId: salesRep.id, source: "ZipRecruiter", skills: ["Phone Sales"], recruiter: true },
    { firstName: "Kevin", lastName: "Martinez", status: "SCREENING", positionId: paralegal.id, source: "LinkedIn", skills: ["Contract Review"] },
    { firstName: "Amanda", lastName: "White", status: "INTERVIEW", positionId: salesRep.id, source: "Indeed", skills: ["Outbound Sales", "Salesforce"], recruiter: true },
    { firstName: "Brian", lastName: "Johnson", status: "INTERVIEW", positionId: marketer.id, source: "LinkedIn", skills: ["Content Marketing"] },
    { firstName: "Nicole", lastName: "Davis", status: "OFFER", positionId: salesRep.id, source: "Referral", skills: ["Account Management"], recruiter: true },
    { firstName: "Carlos", lastName: "Rodriguez", status: "BACKGROUND_CHECK", positionId: salesRep.id, source: "Indeed", skills: ["Sales", "Spanish"], recruiter: true },
    { firstName: "Emily", lastName: "Anderson", status: "HIRED", positionId: salesRep.id, source: "Indeed", skills: ["Sales"] },
    { firstName: "Tom", lastName: "Baker", status: "REJECTED", positionId: paralegal.id, source: "Indeed", skills: ["Legal Research"] },
    { firstName: "Sophie", lastName: "Nguyen", status: "REJECTED", positionId: marketer.id, source: "LinkedIn", skills: ["Social Media"] },
  ];

  const candidates = [] as { id: string; status: string; positionId: string }[];
  for (let i = 0; i < candidateSeed.length; i++) {
    const c = candidateSeed[i];
    const created = await db.candidate.create({
      data: {
        firstName: c.firstName,
        lastName: c.lastName,
        email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@example.com`,
        phone: `(954) 555-01${String(10 + i)}`,
        status: c.status,
        positionId: c.positionId,
        inPipeline: true,
        source: c.source,
        skills: JSON.stringify(c.skills),
        recruiterId: c.recruiter ? hannah.id : null,
        appliedAt: daysAgo(20 - i),
        notes: `Via ${c.source}. Demo candidate for sandbox testing.`,
        ...(c.status === "BACKGROUND_CHECK"
          ? { backgroundCheckStatus: "PENDING", backgroundCheckId: "SBX-DEMO" }
          : {}),
        ...(c.status === "HIRED" ? { hiredAt: daysAgo(2) } : {}),
      },
    });
    candidates.push({ id: created.id, status: c.status, positionId: c.positionId });
  }

  // Upcoming interviews for the two INTERVIEW-stage candidates
  const interviewees = candidates.filter((c) => c.status === "INTERVIEW");
  await Promise.all(
    interviewees.map((c, i) =>
      db.interview.create({
        data: {
          candidateId: c.id,
          positionId: c.positionId,
          type: "VIDEO",
          scheduledAt: daysAhead(i + 1),
          duration: 45,
          status: "SCHEDULED",
          googleEventId: "sandbox-event",
          googleMeetLink: "https://meet.google.com/sandbox-demo-link",
          notes: "Demo interview seeded by sandbox reset.",
        },
      })
    )
  );

  return {
    seeded: {
      departments: 4,
      employees: 7,
      users: ["admin", "hr", "manager", "employee"],
      positions: 4,
      candidates: candidateSeed.length,
      interviews: interviewees.length,
      password: DEMO_PASSWORD,
    },
  };
}
