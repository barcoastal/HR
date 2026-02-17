import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Clean slate
    await db.platformSyncLog.deleteMany();
    await db.platformCostEntry.deleteMany();
    await db.recruitmentPlatform.deleteMany();
    await db.feedReaction.deleteMany();
    await db.feedComment.deleteMany();
    await db.postAttachment.deleteMany();
    await db.feedPost.deleteMany();
    await db.review.deleteMany();
    await db.reviewCycle.deleteMany();
    await db.employeeTask.deleteMany();
    await db.checklistItem.deleteMany();
    await db.onboardingChecklist.deleteMany();
    await db.notification.deleteMany();
    await db.document.deleteMany();
    await db.candidate.deleteMany();
    await db.position.deleteMany();
    await db.user.deleteMany();
    await db.employee.deleteMany();
    await db.team.deleteMany();
    await db.department.deleteMany();

    // --- Departments ---
    const engineering = await db.department.create({ data: { name: "Engineering", description: "Software development and infrastructure" } });
    const product = await db.department.create({ data: { name: "Product", description: "Product management and design" } });
    const marketing = await db.department.create({ data: { name: "Marketing", description: "Brand, growth, and communications" } });
    const hr = await db.department.create({ data: { name: "Human Resources", description: "People operations and culture" } });
    const sales = await db.department.create({ data: { name: "Sales", description: "Revenue and business development" } });
    const finance = await db.department.create({ data: { name: "Finance", description: "Accounting, budgets, and payroll" } });
    const ops = await db.department.create({ data: { name: "Operations", description: "Office management and logistics" } });

    // Sub-departments
    const frontend = await db.department.create({ data: { name: "Frontend", description: "Web and mobile UI", parentDepartmentId: engineering.id } });
    const backend = await db.department.create({ data: { name: "Backend", description: "APIs and services", parentDepartmentId: engineering.id } });
    const devops = await db.department.create({ data: { name: "DevOps", description: "Infrastructure and CI/CD", parentDepartmentId: engineering.id } });

    // --- Teams ---
    const webTeam = await db.team.create({ data: { name: "Web Platform", departmentId: frontend.id } });
    const mobileTeam = await db.team.create({ data: { name: "Mobile App", departmentId: frontend.id } });
    const apiTeam = await db.team.create({ data: { name: "Core API", departmentId: backend.id } });
    const dataTeam = await db.team.create({ data: { name: "Data Pipeline", departmentId: backend.id } });
    const infraTeam = await db.team.create({ data: { name: "Infrastructure", departmentId: devops.id } });
    const designTeam = await db.team.create({ data: { name: "Design", departmentId: product.id } });
    const growthTeam = await db.team.create({ data: { name: "Growth", departmentId: marketing.id } });
    const contentTeam = await db.team.create({ data: { name: "Content", departmentId: marketing.id } });
    const salesTeam = await db.team.create({ data: { name: "Enterprise Sales", departmentId: sales.id } });
    const sdrTeam = await db.team.create({ data: { name: "SDR Team", departmentId: sales.id } });

    // --- Employees ---
    const emps = [];

    const employeeData = [
      // Engineering leadership
      { firstName: "Marcus", lastName: "Chen", email: "marcus.chen@coastal.io", jobTitle: "VP of Engineering", departmentId: engineering.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0101", birthday: new Date("1985-03-15"), hobbies: "Rock climbing, chess, open source", bio: "15 years in tech. Previously at Stripe and Google.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-01-10") },
      // Frontend
      { firstName: "Sarah", lastName: "Kim", email: "sarah.kim@coastal.io", jobTitle: "Frontend Lead", departmentId: frontend.id, teamId: webTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0102", birthday: new Date("1990-07-22"), hobbies: "Photography, hiking", bio: "React specialist, previously at Airbnb.", location: "San Francisco, CA", dietaryRestrictions: "Vegetarian", startDate: new Date("2022-03-01") },
      { firstName: "Jake", lastName: "Morrison", email: "jake.morrison@coastal.io", jobTitle: "Senior Frontend Developer", departmentId: frontend.id, teamId: webTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0103", birthday: new Date("1992-11-08"), hobbies: "Gaming, cooking", bio: "Full-stack leaning frontend. TypeScript enthusiast.", location: "Oakland, CA", dietaryRestrictions: null, startDate: new Date("2022-06-15") },
      { firstName: "Priya", lastName: "Patel", email: "priya.patel@coastal.io", jobTitle: "Frontend Developer", departmentId: frontend.id, teamId: webTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0104", birthday: new Date("1995-02-14"), hobbies: "Yoga, painting", bio: "CSS wizard. Accessibility advocate.", location: "San Jose, CA", dietaryRestrictions: "Vegan", startDate: new Date("2023-01-09") },
      { firstName: "Tommy", lastName: "Nguyen", email: "tommy.nguyen@coastal.io", jobTitle: "Mobile Developer", departmentId: frontend.id, teamId: mobileTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0105", birthday: new Date("1993-09-30"), hobbies: "Surfing, board games", bio: "React Native and Swift. Built 3 apps with 1M+ downloads.", location: "Santa Cruz, CA", dietaryRestrictions: null, startDate: new Date("2022-09-01") },
      { firstName: "Lisa", lastName: "Wang", email: "lisa.wang@coastal.io", jobTitle: "Mobile Developer", departmentId: frontend.id, teamId: mobileTeam.id, status: "ONBOARDING" as const, phone: "+1-415-555-0106", birthday: new Date("1996-05-18"), hobbies: "Piano, running", bio: "Joining from Meta. Flutter and Kotlin expert.", location: "Palo Alto, CA", dietaryRestrictions: "Gluten-free", startDate: new Date("2026-02-10") },
      // Backend
      { firstName: "David", lastName: "Okafor", email: "david.okafor@coastal.io", jobTitle: "Backend Lead", departmentId: backend.id, teamId: apiTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0107", birthday: new Date("1988-12-03"), hobbies: "Soccer, reading sci-fi", bio: "Distributed systems architect. Prev at AWS.", location: "Seattle, WA", dietaryRestrictions: null, startDate: new Date("2022-02-14") },
      { firstName: "Emma", lastName: "Rodriguez", email: "emma.rodriguez@coastal.io", jobTitle: "Senior Backend Developer", departmentId: backend.id, teamId: apiTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0108", birthday: new Date("1991-04-25"), hobbies: "Baking, travel", bio: "Node.js and Go. API design fanatic.", location: "Portland, OR", dietaryRestrictions: null, startDate: new Date("2022-08-01") },
      { firstName: "Ryan", lastName: "O'Brien", email: "ryan.obrien@coastal.io", jobTitle: "Backend Developer", departmentId: backend.id, teamId: apiTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0109", birthday: new Date("1994-08-12"), hobbies: "Mountain biking, podcasts", bio: "Python and Rust developer. Loves performance tuning.", location: "Denver, CO", dietaryRestrictions: "Lactose intolerant", startDate: new Date("2023-04-01") },
      { firstName: "Mei", lastName: "Zhang", email: "mei.zhang@coastal.io", jobTitle: "Data Engineer", departmentId: backend.id, teamId: dataTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0110", birthday: new Date("1993-01-07"), hobbies: "Gardening, machine learning", bio: "Built data pipelines processing 10TB/day.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2023-02-01") },
      { firstName: "Alex", lastName: "Petrov", email: "alex.petrov@coastal.io", jobTitle: "Junior Data Engineer", departmentId: backend.id, teamId: dataTeam.id, status: "ONBOARDING" as const, phone: "+1-415-555-0111", birthday: new Date("1998-10-20"), hobbies: "Competitive programming", bio: "Fresh from Stanford CS. Spark and Airflow.", location: "Mountain View, CA", dietaryRestrictions: null, startDate: new Date("2026-02-03") },
      // DevOps
      { firstName: "Jordan", lastName: "Blake", email: "jordan.blake@coastal.io", jobTitle: "DevOps Lead", departmentId: devops.id, teamId: infraTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0112", birthday: new Date("1987-06-09"), hobbies: "Homelab, woodworking", bio: "Kubernetes whisperer. 99.99% uptime track record.", location: "Austin, TX", dietaryRestrictions: null, startDate: new Date("2022-04-01") },
      { firstName: "Sam", lastName: "Taylor", email: "sam.taylor@coastal.io", jobTitle: "SRE Engineer", departmentId: devops.id, teamId: infraTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0113", birthday: new Date("1992-03-28"), hobbies: "Climbing, reading", bio: "Terraform and AWS. Previously at Datadog.", location: "Austin, TX", dietaryRestrictions: "Pescatarian", startDate: new Date("2023-07-15") },
      // Product
      { firstName: "Rachel", lastName: "Foster", email: "rachel.foster@coastal.io", jobTitle: "Head of Product", departmentId: product.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0114", birthday: new Date("1986-11-14"), hobbies: "Wine tasting, travel", bio: "Product leader. 12 years in B2B SaaS.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-01-15") },
      { firstName: "Nate", lastName: "Williams", email: "nate.williams@coastal.io", jobTitle: "Senior Product Manager", departmentId: product.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0115", birthday: new Date("1989-09-05"), hobbies: "Basketball, writing", bio: "Data-driven PM. Previously at Salesforce.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-11-01") },
      { firstName: "Ava", lastName: "Green", email: "ava.green@coastal.io", jobTitle: "UX Designer", departmentId: product.id, teamId: designTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0116", birthday: new Date("1994-04-03"), hobbies: "Illustration, ceramics", bio: "Design systems expert. Figma power user.", location: "Brooklyn, NY", dietaryRestrictions: "Vegan", startDate: new Date("2023-03-01") },
      { firstName: "Carlos", lastName: "Reyes", email: "carlos.reyes@coastal.io", jobTitle: "UI Designer", departmentId: product.id, teamId: designTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0117", birthday: new Date("1996-07-19"), hobbies: "Skateboarding, music production", bio: "Visual design and motion graphics.", location: "Los Angeles, CA", dietaryRestrictions: null, startDate: new Date("2023-09-01") },
      // Marketing
      { firstName: "Hannah", lastName: "Cooper", email: "hannah.cooper@coastal.io", jobTitle: "Marketing Director", departmentId: marketing.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0118", birthday: new Date("1988-02-28"), hobbies: "Pilates, reading", bio: "Growth marketing leader. Built teams at 3 startups.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-05-01") },
      { firstName: "Ben", lastName: "Hughes", email: "ben.hughes@coastal.io", jobTitle: "Growth Manager", departmentId: marketing.id, teamId: growthTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0119", birthday: new Date("1993-12-10"), hobbies: "Running, data viz", bio: "SEO and paid acquisition specialist.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2023-01-15") },
      { firstName: "Olivia", lastName: "James", email: "olivia.james@coastal.io", jobTitle: "Content Writer", departmentId: marketing.id, teamId: contentTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0120", birthday: new Date("1995-08-07"), hobbies: "Creative writing, hiking", bio: "B2B content and thought leadership.", location: "Portland, OR", dietaryRestrictions: "Vegetarian", startDate: new Date("2023-06-01") },
      // Sales
      { firstName: "Michael", lastName: "Davis", email: "michael.davis@coastal.io", jobTitle: "VP of Sales", departmentId: sales.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0121", birthday: new Date("1984-05-22"), hobbies: "Golf, wine", bio: "20 years in enterprise sales. Closed $50M+ ARR.", location: "New York, NY", dietaryRestrictions: null, startDate: new Date("2022-02-01") },
      { firstName: "Jessica", lastName: "Park", email: "jessica.park@coastal.io", jobTitle: "Account Executive", departmentId: sales.id, teamId: salesTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0122", birthday: new Date("1991-10-15"), hobbies: "Tennis, cooking", bio: "Enterprise AE. 150% quota attainment.", location: "New York, NY", dietaryRestrictions: null, startDate: new Date("2023-02-01") },
      { firstName: "Chris", lastName: "Murphy", email: "chris.murphy@coastal.io", jobTitle: "SDR", departmentId: sales.id, teamId: sdrTeam.id, status: "ACTIVE" as const, phone: "+1-415-555-0123", birthday: new Date("1997-06-30"), hobbies: "Music, volleyball", bio: "Top SDR. 200+ meetings booked in 2025.", location: "Chicago, IL", dietaryRestrictions: null, startDate: new Date("2024-01-08") },
      { firstName: "Zoe", lastName: "Mitchell", email: "zoe.mitchell@coastal.io", jobTitle: "SDR", departmentId: sales.id, teamId: sdrTeam.id, status: "ONBOARDING" as const, phone: "+1-415-555-0124", birthday: new Date("1999-03-12"), hobbies: "Dance, reading", bio: "Recent grad. Excited to join the team!", location: "Chicago, IL", dietaryRestrictions: null, startDate: new Date("2026-02-12") },
      // HR
      { firstName: "Diana", lastName: "Luna", email: "diana.luna@coastal.io", jobTitle: "HR Director", departmentId: hr.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0125", birthday: new Date("1987-01-20"), hobbies: "Meditation, travel", bio: "People-first HR leader. SHRM certified.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-01-03") },
      { firstName: "Kevin", lastName: "Wright", email: "kevin.wright@coastal.io", jobTitle: "HR Generalist", departmentId: hr.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0126", birthday: new Date("1993-11-25"), hobbies: "Cooking, board games", bio: "Benefits and compliance specialist.", location: "San Francisco, CA", dietaryRestrictions: "Kosher", startDate: new Date("2023-05-01") },
      // Finance
      { firstName: "Patricia", lastName: "Edwards", email: "patricia.edwards@coastal.io", jobTitle: "CFO", departmentId: finance.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0127", birthday: new Date("1982-09-18"), hobbies: "Reading, gardening", bio: "20+ years in finance. CPA. Previously at Deloitte.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-03-01") },
      { firstName: "Tom", lastName: "Baker", email: "tom.baker@coastal.io", jobTitle: "Accountant", departmentId: finance.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0128", birthday: new Date("1994-04-14"), hobbies: "Cycling, music", bio: "AP/AR and financial reporting.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2023-08-01") },
      // Operations
      { firstName: "Grace", lastName: "Santos", email: "grace.santos@coastal.io", jobTitle: "Office Manager", departmentId: ops.id, teamId: null, status: "ACTIVE" as const, phone: "+1-415-555-0129", birthday: new Date("1990-12-01"), hobbies: "Event planning, dogs", bio: "Keeps the office running smoothly.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-06-01") },
      // Offboarded employees
      { firstName: "Derek", lastName: "Stone", email: "derek.stone@coastal.io", jobTitle: "Backend Developer", departmentId: backend.id, teamId: apiTeam.id, status: "OFFBOARDED" as const, phone: "+1-415-555-0130", birthday: new Date("1991-07-04"), hobbies: "Photography", bio: "Left to join a startup.", location: "San Francisco, CA", dietaryRestrictions: null, startDate: new Date("2022-05-01") },
      { firstName: "Nicole", lastName: "Adams", email: "nicole.adams@coastal.io", jobTitle: "Marketing Specialist", departmentId: marketing.id, teamId: growthTeam.id, status: "OFFBOARDED" as const, phone: "+1-415-555-0131", birthday: new Date("1994-02-08"), hobbies: "Travel, yoga", bio: "Relocated to London.", location: "London, UK", dietaryRestrictions: null, startDate: new Date("2023-01-15") },
    ];

    for (const emp of employeeData) {
      const created = await db.employee.create({
        data: {
          ...emp,
          endDate: emp.status === "OFFBOARDED" ? new Date("2025-12-15") : null,
          anniversaryDate: emp.startDate,
          benefitsEligibleDate: new Date(emp.startDate.getTime() + 90 * 24 * 60 * 60 * 1000),
        },
      });
      emps.push(created);
    }

    // Set managers
    const marcus = emps[0];
    const sarahK = emps[1];
    const davidO = emps[6];
    const jordanB = emps[11];
    const rachelF = emps[13];
    const hannahC = emps[17];
    const michaelD = emps[20];
    const dianaL = emps[24];

    // Set department heads
    await db.department.update({ where: { id: engineering.id }, data: { headId: marcus.id } });
    await db.department.update({ where: { id: frontend.id }, data: { headId: sarahK.id } });
    await db.department.update({ where: { id: backend.id }, data: { headId: davidO.id } });
    await db.department.update({ where: { id: devops.id }, data: { headId: jordanB.id } });
    await db.department.update({ where: { id: product.id }, data: { headId: rachelF.id } });
    await db.department.update({ where: { id: marketing.id }, data: { headId: hannahC.id } });
    await db.department.update({ where: { id: sales.id }, data: { headId: michaelD.id } });
    await db.department.update({ where: { id: hr.id }, data: { headId: dianaL.id } });

    // Set manager relationships
    for (const emp of [emps[1], emps[6], emps[11]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: marcus.id } });
    for (const emp of [emps[2], emps[3], emps[4], emps[5]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: sarahK.id } });
    for (const emp of [emps[7], emps[8], emps[9], emps[10], emps[30]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: davidO.id } });
    for (const emp of [emps[12]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: jordanB.id } });
    for (const emp of [emps[14], emps[15], emps[16]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: rachelF.id } });
    for (const emp of [emps[18], emps[19], emps[31]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: hannahC.id } });
    for (const emp of [emps[21], emps[22], emps[23]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: michaelD.id } });
    for (const emp of [emps[25]]) await db.employee.update({ where: { id: emp.id }, data: { managerId: dianaL.id } });

    // --- Onboarding Checklists ---
    const onboardingChecklist = await db.onboardingChecklist.create({
      data: {
        name: "New Hire Onboarding",
        type: "ONBOARDING",
        items: {
          create: [
            { title: "Complete I-9 form", description: "Verify employment eligibility", order: 1, requiresDocument: true },
            { title: "Set up laptop and accounts", description: "IT will provision all tools", order: 2 },
            { title: "Review employee handbook", description: "Read and acknowledge company policies", order: 3, requiresDocument: true },
            { title: "Meet your team", description: "Schedule intro meetings with teammates", order: 4 },
            { title: "Complete security training", description: "Annual security awareness course", order: 5 },
            { title: "Set up direct deposit", description: "Payroll banking information", order: 6, requiresDocument: true },
            { title: "Enroll in benefits", description: "Health, dental, vision, 401k", order: 7 },
            { title: "First week check-in with manager", description: "30-minute sync to discuss goals", order: 8, dueDay: 5 },
          ],
        },
      },
    });

    const offboardingChecklist = await db.onboardingChecklist.create({
      data: {
        name: "Employee Offboarding",
        type: "OFFBOARDING",
        items: {
          create: [
            { title: "Return company equipment", description: "Laptop, badge, keys", order: 1 },
            { title: "Transfer knowledge", description: "Document ongoing projects", order: 2 },
            { title: "Exit interview", description: "Schedule with HR", order: 3 },
            { title: "Revoke system access", description: "IT disables all accounts", order: 4 },
            { title: "Final paycheck review", description: "Verify PTO payout and final pay", order: 5 },
          ],
        },
      },
    });

    // Assign onboarding tasks to ONBOARDING employees
    const onboardingItems = await db.checklistItem.findMany({ where: { checklistId: onboardingChecklist.id } });
    const onboardingEmps = emps.filter(e => employeeData.find(d => d.email === e.email)?.status === "ONBOARDING");
    for (const emp of onboardingEmps) {
      for (const item of onboardingItems) {
        await db.employeeTask.create({
          data: { employeeId: emp.id, checklistItemId: item.id, status: "PENDING" },
        });
      }
    }

    // Assign offboarding tasks to OFFBOARDED employees (mark some done)
    const offboardingItems = await db.checklistItem.findMany({ where: { checklistId: offboardingChecklist.id } });
    const offboardedEmps = emps.filter(e => employeeData.find(d => d.email === e.email)?.status === "OFFBOARDED");
    for (const emp of offboardedEmps) {
      for (let i = 0; i < offboardingItems.length; i++) {
        await db.employeeTask.create({
          data: {
            employeeId: emp.id,
            checklistItemId: offboardingItems[i].id,
            status: i < 3 ? "DONE" : "PENDING",
            completedAt: i < 3 ? new Date() : null,
          },
        });
      }
    }

    // --- Positions & Candidates ---
    const positions = await Promise.all([
      db.position.create({ data: { title: "Senior Frontend Engineer", departmentId: frontend.id, description: "Build next-gen UI", salary: "$150k-$180k", status: "OPEN" } }),
      db.position.create({ data: { title: "Backend Engineer", departmentId: backend.id, description: "Scale our APIs", salary: "$140k-$170k", status: "OPEN" } }),
      db.position.create({ data: { title: "Product Designer", departmentId: product.id, description: "Design delightful experiences", salary: "$130k-$160k", status: "OPEN" } }),
      db.position.create({ data: { title: "DevOps Engineer", departmentId: devops.id, description: "Keep systems reliable", salary: "$145k-$175k", status: "FILLED" } }),
      db.position.create({ data: { title: "Marketing Manager", departmentId: marketing.id, description: "Drive growth initiatives", salary: "$120k-$150k", status: "OPEN" } }),
    ]);

    const candidateData = [
      { firstName: "Aaron", lastName: "Lee", email: "aaron.lee@gmail.com", status: "INTERVIEW" as const, source: "LinkedIn", positionId: positions[0].id, phone: "+1-555-0201", skills: "React, TypeScript, Next.js", experience: "5 years", notes: "Strong portfolio. Good culture fit.", costOfHire: 5000 },
      { firstName: "Bella", lastName: "Martin", email: "bella.martin@gmail.com", status: "NEW" as const, source: "Indeed", positionId: positions[0].id, phone: "+1-555-0202", skills: "Vue, JavaScript, CSS", experience: "3 years", costOfHire: 2000 },
      { firstName: "Chad", lastName: "Wilson", email: "chad.wilson@outlook.com", status: "SCREENING" as const, source: "Referral", positionId: positions[1].id, phone: "+1-555-0203", skills: "Go, Python, PostgreSQL", experience: "7 years", notes: "Referred by David Okafor.", costOfHire: 1500 },
      { firstName: "Dana", lastName: "Brooks", email: "dana.brooks@yahoo.com", status: "OFFER" as const, source: "LinkedIn", positionId: positions[1].id, phone: "+1-555-0204", skills: "Node.js, TypeScript, MongoDB", experience: "4 years", notes: "Offer sent at $160k. Waiting for response.", costOfHire: 6000 },
      { firstName: "Ethan", lastName: "Ross", email: "ethan.ross@gmail.com", status: "INTERVIEW" as const, source: "Company Website", positionId: positions[2].id, phone: "+1-555-0205", skills: "Figma, Sketch, user research", experience: "6 years", notes: "Second interview scheduled for next week.", costOfHire: 3500 },
      { firstName: "Fiona", lastName: "Hart", email: "fiona.hart@gmail.com", status: "HIRED" as const, source: "Referral", positionId: positions[3].id, phone: "+1-555-0206", skills: "Kubernetes, Terraform, AWS", experience: "8 years", notes: "Accepted offer. Starting March 1.", costOfHire: 4000, hiredAt: new Date("2026-01-20") },
      { firstName: "George", lastName: "Liu", email: "george.liu@gmail.com", status: "REJECTED" as const, source: "Indeed", positionId: positions[0].id, phone: "+1-555-0207", skills: "jQuery, PHP", experience: "10 years", notes: "Skills not aligned with our stack.", costOfHire: 1000 },
      { firstName: "Hana", lastName: "Sato", email: "hana.sato@gmail.com", status: "SCREENING" as const, source: "LinkedIn", positionId: positions[4].id, phone: "+1-555-0208", skills: "SEO, Google Ads, content strategy", experience: "5 years", costOfHire: 2500 },
      { firstName: "Ian", lastName: "Clark", email: "ian.clark@gmail.com", status: "NEW" as const, source: "Company Website", positionId: positions[1].id, phone: "+1-555-0209", skills: "Rust, C++, systems programming", experience: "3 years", costOfHire: 1000 },
      { firstName: "Julia", lastName: "Brown", email: "julia.brown@gmail.com", status: "INTERVIEW" as const, source: "Referral", positionId: positions[2].id, phone: "+1-555-0210", skills: "Figma, prototyping, design systems", experience: "4 years", notes: "Impressive case study presentation.", costOfHire: 3000 },
    ];

    for (const c of candidateData) {
      await db.candidate.create({ data: c });
    }

    // --- Review Cycles ---
    const q4Cycle = await db.reviewCycle.create({
      data: { name: "Q4 2025 Performance Review", startDate: new Date("2025-10-01"), endDate: new Date("2025-12-31"), status: "CLOSED" },
    });
    const q1Cycle = await db.reviewCycle.create({
      data: { name: "Q1 2026 Performance Review", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), status: "ACTIVE" },
    });

    const activeEmps = emps.filter(e => employeeData.find(d => d.email === e.email)?.status === "ACTIVE");
    // Create some reviews for Q4 (closed, submitted)
    for (let i = 0; i < Math.min(10, activeEmps.length); i++) {
      const emp = activeEmps[i];
      const reviewer = activeEmps[(i + 1) % activeEmps.length];
      await db.review.create({
        data: {
          cycleId: q4Cycle.id, employeeId: emp.id, reviewerId: reviewer.id,
          type: "MANAGER", status: "SUBMITTED", rating: 3 + Math.floor(Math.random() * 3),
          strengths: "Consistently delivers high-quality work. Great team player.",
          improvements: "Could improve on time management and documentation.",
          goals: "Lead a major project. Mentor a junior team member.",
        },
      });
    }
    // Create pending reviews for Q1
    for (let i = 0; i < Math.min(15, activeEmps.length); i++) {
      const emp = activeEmps[i];
      const reviewer = activeEmps[(i + 3) % activeEmps.length];
      await db.review.create({
        data: {
          cycleId: q1Cycle.id, employeeId: emp.id, reviewerId: reviewer.id,
          type: "MANAGER", status: i < 5 ? "SUBMITTED" : "PENDING",
          rating: i < 5 ? 3 + Math.floor(Math.random() * 3) : null,
          strengths: i < 5 ? "Shows initiative and strong problem-solving skills." : null,
          improvements: i < 5 ? "Communication with cross-functional teams." : null,
        },
      });
    }

    // --- Feed Posts ---
    const feedEmps = activeEmps.slice(0, 10);
    await db.feedPost.create({ data: { authorId: dianaL.id, content: "Welcome to our newest team members joining this month! Please make sure to say hello and help them feel at home. Remember, a warm welcome goes a long way! 🎉", type: "NEW_HIRE", pinned: true } });
    await db.feedPost.create({ data: { authorId: marcus.id, content: "Huge shoutout to the engineering team for shipping the v3.0 release on time! This was our biggest launch yet with 47 new features. Incredible work from everyone involved.", type: "ANNOUNCEMENT", pinned: true } });
    await db.feedPost.create({ data: { authorId: rachelF.id, content: "Product roadmap for Q1 2026 is now published. Check it out in Notion. Excited about the direction we're heading!", type: "GENERAL" } });
    await db.feedPost.create({ data: { authorId: hannahC.id, content: "Our latest blog post just hit 50K views! Amazing work by the content team. Keep the momentum going! 📈", type: "GENERAL" } });
    await db.feedPost.create({ data: { authorId: feedEmps[4].id, content: "Just got back from the React Summit conference. So many great talks! I'll be doing a knowledge sharing session on Friday at 2pm if anyone's interested.", type: "GENERAL" } });
    await db.feedPost.create({ data: { authorId: dianaL.id, content: "Reminder: Open enrollment for 2026 benefits ends February 28th. Please review your options and make any changes before the deadline.", type: "ANNOUNCEMENT" } });
    await db.feedPost.create({ data: { authorId: michaelD.id, content: "Q4 numbers are in — we hit 142% of our annual target! Every single person on this team contributed to this milestone. Celebrating this Friday! 🥂", type: "ANNOUNCEMENT" } });
    await db.feedPost.create({ data: { authorId: feedEmps[2].id, content: "Anyone interested in starting a lunch running club? Thinking Tuesdays and Thursdays. Drop a comment if you're in!", type: "GENERAL" } });

    // --- Recruitment Platforms ---
    const now = new Date();
    const platformData = [
      { name: "LinkedIn Recruiter", type: "PREMIUM" as const, monthlyCost: 825, status: "ACTIVE" as const, apiKey: "li-demo-key-2024" },
      { name: "Indeed", type: "PREMIUM" as const, monthlyCost: 300, status: "ACTIVE" as const, apiKey: "indeed-demo-key-2024" },
      { name: "Handshake", type: "NICHE" as const, monthlyCost: 150, status: "ACTIVE" as const, apiKey: null as string | null },
      { name: "EmployFL", type: "NICHE" as const, monthlyCost: 0, status: "ACTIVE" as const, apiKey: null as string | null },
      { name: "Facebook Jobs", type: "SOCIAL" as const, monthlyCost: 50, status: "PAUSED" as const, apiKey: null as string | null },
    ];

    for (const pd of platformData) {
      const platform = await db.recruitmentPlatform.create({
        data: {
          name: pd.name,
          type: pd.type,
          monthlyCost: pd.monthlyCost,
          status: pd.status,
          apiKey: pd.apiKey,
          connectedAt: pd.apiKey ? now : undefined,
        },
      });

      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        await db.platformCostEntry.create({
          data: {
            platformId: platform.id,
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            cost: pd.monthlyCost,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      counts: {
        departments: 10,
        teams: 10,
        employees: emps.length,
        onboarding: onboardingEmps.length,
        offboarded: offboardedEmps.length,
        positions: positions.length,
        candidates: candidateData.length,
        reviewCycles: 2,
        feedPosts: 8,
        recruitmentPlatforms: platformData.length,
      },
    });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
