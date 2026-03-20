import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// CSV data from coastal-debt-employees.csv
const CSV_EMPLOYEES = [
  { firstName: "Julio", lastName: "Alfonso", email: "julio@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Christian", lastName: "Alvarez", email: "calvarez@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Marquez", lastName: "Burnside", email: "marquez@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Renee", lastName: "Clayton", email: "rclayton@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Alecha", lastName: "Edwards", email: "alecha@coastaldebt.com", jobTitle: "Customer Support", department: "Customer Support" },
  { firstName: "Yeislee", lastName: "Flores", email: "yeislee@coastaldebt.com", jobTitle: "Customer Support/Retention Manager", department: "Customer Support" },
  { firstName: "Ruben", lastName: "Galindo", email: "rgalindo@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Marco", lastName: "Glave", email: "mglave@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "David", lastName: "Medina", email: "david@coastaldebt.com", jobTitle: "Customer Support", department: "Customer Support" },
  { firstName: "Sarah", lastName: "Medina", email: "smedina@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Ferron", lastName: "Permohamed", email: "ferron@coastaldebt.com", jobTitle: "CRM Manager - Retention", department: "Customer Support" },
  { firstName: "Ann", lastName: "Pierre-Pierre", email: null, jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Timothy", lastName: "Rivadeneira", email: "timr@coastaldebt.com", jobTitle: "Customer Support", department: "Customer Support" },
  { firstName: "Carlos", lastName: "Sanchez", email: "carlos@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Simone", lastName: "Simpson", email: "ssimpson@coastaldebt.com", jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Angie", lastName: "Wilson", email: null, jobTitle: "Retention Specialist", department: "Customer Support" },
  { firstName: "Allison", lastName: "Biscardi", email: null, jobTitle: "Authorized Member", department: "General & Admin" },
  { firstName: "Shachar", lastName: "Matmon", email: null, jobTitle: "Managing Member", department: "General & Admin" },
  { firstName: "Sandra", lastName: "Garcia Hopkins", email: "sandra@coastaldebt.com", jobTitle: "VP, Human Resources", department: "Human Resource" },
  { firstName: "David", lastName: "Garen", email: "dgaren@coastaldebt.com", jobTitle: "High Volume Recruiter", department: "Human Resource" },
  { firstName: "Jeanne", lastName: "Langlois", email: "jlanglois@coastaldebt.com", jobTitle: "High-Volume Recruiter", department: "Human Resource" },
  { firstName: "Alexis", lastName: "Lawton", email: "alexis@coastaldebt.com", jobTitle: "Administrative Assistant", department: "Human Resource" },
  { firstName: "Richard", lastName: "Lowe", email: "rlowe@coastaldebt.com", jobTitle: "Content Strategist", department: "Marketing" },
  { firstName: "Seth", lastName: "Sweet", email: "ssweet@coastaldebt.com", jobTitle: "CRM Manager - Sales", department: "Sales" },
  { firstName: "Adir", lastName: "Aflalo", email: "daflalo@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Christopher", lastName: "Ayala", email: "cayala@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Zachary", lastName: "Blyweiss", email: "zachary@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Christopher", lastName: "Boulahanis", email: null, jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Elcain", lastName: "Chase", email: "echase@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Craig", lastName: "Cohen", email: "cohen@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Carlos", lastName: "Hunter", email: "chunter@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Zane", lastName: "Kerns", email: "zane.kerns@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Juan", lastName: "Limongi", email: "jlimongi@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Shlomo", lastName: "Mor-Josef", email: null, jobTitle: "Sales Floor Manager", department: "Sales - Closers" },
  { firstName: "Tahja", lastName: "Palmer", email: "tpalmer@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Zachary", lastName: "Redick", email: "redick@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Dartanian", lastName: "Reed", email: "lreed@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Agustine", lastName: "Saenz", email: "asaenz@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Nathan", lastName: "Toney", email: "nathant@coastaldebt.com", jobTitle: "Senior Settlement Advisor", department: "Sales - Closers" },
  { firstName: "Robert", lastName: "Allen", email: "rallen@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "George", lastName: "Ausby", email: "gausby@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Abriel", lastName: "Bell", email: "abell@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Harrod", lastName: "Berger", email: "harrod@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Diego", lastName: "Bermudez", email: "dbermudez@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Carl", lastName: "Christy", email: "cchristy@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Monique", lastName: "Coleman", email: null, jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Fernando", lastName: "Cruz", email: "fernando@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Garett", lastName: "Davis", email: null, jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Josh", lastName: "Douyon", email: "jdouyon@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Anais", lastName: "Hernandez", email: null, jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Sidney", lastName: "Johnson", email: "sjohnson@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Tedd", lastName: "Lee", email: null, jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Ashley", lastName: "Lloyd", email: "alloyd@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Sharon", lastName: "Mahabir", email: "smahabir@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Charles", lastName: "McDowell Jr", email: "cmcdowell@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Jaime", lastName: "Mercado", email: "jmercado@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Lara", lastName: "Mesquita", email: "lmesquita@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Keldrick", lastName: "Mobley", email: "kmobley@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Jacques", lastName: "Monuma", email: "jacques@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Naida", lastName: "Nicolas", email: "nnicolas@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Lionel", lastName: "Pratt", email: "lionel@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Menachem", lastName: "Rabin", email: "mrabin@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Jahiydi", lastName: "Rivera", email: "jrivera@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Cindy", lastName: "Romanczak", email: null, jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Niresh", lastName: "Santu", email: "nsantu@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Logan", lastName: "Wheatle", email: "lwheatle@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Arric", lastName: "Wilson", email: "awilson@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Nadeene", lastName: "Wilson", email: "nwilson@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Ronnie", lastName: "Wright", email: "ronnie@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Akeem", lastName: "Wright", email: "awright@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
  { firstName: "Dwayne", lastName: "Young Jr.", email: "dyoun@coastaldebt.com", jobTitle: "Settlement Advisor", department: "Sales - Openers" },
];

// Org hierarchy based on roles:
// Shachar Matmon (Managing Member) = CEO-level, top of tree
// Allison Biscardi (Authorized Member) → reports to Shachar
// Sandra Garcia Hopkins (VP, HR) → reports to Shachar
//   HR team → reports to Sandra
// Yeislee Flores (CS/Retention Manager) → reports to Shachar
//   Ferron Permohamed (CRM Manager - Retention) → reports to Yeislee
//   CS/Retention staff → reports to Yeislee
// Seth Sweet (CRM Manager - Sales) → reports to Shachar
// Shlomo Mor-Josef (Sales Floor Manager) → reports to Seth Sweet
//   Senior Settlement Advisors (Closers) → reports to Shlomo
// Settlement Advisors (Openers) → reports to Seth Sweet
// Richard Lowe (Content Strategist / Marketing) → reports to Shachar

const MANAGER_RULES: Record<string, string> = {
  // Department-based + title-based manager assignment
  // Key = "department::jobTitle" or "department" (fallback)
  "General & Admin::Authorized Member": "Shachar Matmon",
  "Human Resource::VP, Human Resources": "Shachar Matmon",
  "Human Resource": "Sandra Garcia Hopkins",
  "Customer Support::Customer Support/Retention Manager": "Shachar Matmon",
  "Customer Support::CRM Manager - Retention": "Yeislee Flores",
  "Customer Support": "Yeislee Flores",
  "Sales::CRM Manager - Sales": "Shachar Matmon",
  "Marketing": "Shachar Matmon",
  "Sales - Closers::Sales Floor Manager": "Seth Sweet",
  "Sales - Closers": "Shlomo Mor-Josef",
  "Sales - Openers": "Seth Sweet",
};

function getManagerName(dept: string, title: string): string | null {
  // Try specific match first
  const specific = MANAGER_RULES[`${dept}::${title}`];
  if (specific) return specific;
  // Fallback to department
  return MANAGER_RULES[dept] || null;
}

export async function GET(req: NextRequest) {
  // Simple secret key auth for one-time script
  const key = req.nextUrl.searchParams.get("key");
  if (key !== "coastal-sync-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];

  // 1. Create all unique job titles
  const uniqueTitles = [...new Set(CSV_EMPLOYEES.map((e) => e.jobTitle))];
  let titlesCreated = 0;
  for (const title of uniqueTitles) {
    const existing = await db.jobTitle.findFirst({ where: { name: title } });
    if (!existing) {
      await db.jobTitle.create({ data: { name: title } });
      titlesCreated++;
      log.push(`Created job title: ${title}`);
    }
  }

  // 2. Create departments that don't exist
  const uniqueDepts = [...new Set(CSV_EMPLOYEES.map((e) => e.department))];
  for (const deptName of uniqueDepts) {
    const existing = await db.department.findFirst({
      where: { name: { equals: deptName, mode: "insensitive" } },
    });
    if (!existing) {
      await db.department.create({ data: { name: deptName } });
      log.push(`Created department: ${deptName}`);
    }
  }

  // 3. Update each employee's jobTitle and department
  let updated = 0;
  let notFound = 0;
  const employeeIdMap: Record<string, string> = {}; // "FirstName LastName" → id

  for (const csvEmp of CSV_EMPLOYEES) {
    // Find employee by email or by first+last name
    let employee = null;
    if (csvEmp.email) {
      employee = await db.employee.findUnique({ where: { email: csvEmp.email } });
    }
    if (!employee) {
      // Try by name
      employee = await db.employee.findFirst({
        where: {
          firstName: { equals: csvEmp.firstName, mode: "insensitive" },
          lastName: { equals: csvEmp.lastName, mode: "insensitive" },
        },
      });
    }
    // Also try pending email pattern
    if (!employee) {
      const pendingEmail = `${csvEmp.firstName.toLowerCase()}.${csvEmp.lastName.toLowerCase().replace(/\s+/g, '')}@pending.local`;
      employee = await db.employee.findUnique({ where: { email: pendingEmail } });
    }

    if (!employee) {
      log.push(`NOT FOUND: ${csvEmp.firstName} ${csvEmp.lastName} (${csvEmp.email || 'no email'})`);
      notFound++;
      continue;
    }

    // Store in map for manager resolution
    employeeIdMap[`${csvEmp.firstName} ${csvEmp.lastName}`] = employee.id;

    // Resolve department
    const dept = await db.department.findFirst({
      where: { name: { equals: csvEmp.department, mode: "insensitive" } },
    });

    await db.employee.update({
      where: { id: employee.id },
      data: {
        jobTitle: csvEmp.jobTitle,
        departmentId: dept?.id || employee.departmentId,
      },
    });
    updated++;
  }

  // 4. Set up manager relationships
  let managersSet = 0;
  for (const csvEmp of CSV_EMPLOYEES) {
    // Skip the top-level person
    if (csvEmp.jobTitle === "Managing Member") continue;

    const empKey = `${csvEmp.firstName} ${csvEmp.lastName}`;
    const empId = employeeIdMap[empKey];
    if (!empId) continue;

    const managerName = getManagerName(csvEmp.department, csvEmp.jobTitle);
    if (!managerName) continue;

    const managerId = employeeIdMap[managerName];
    if (!managerId) {
      log.push(`Manager not found in map: ${managerName} (for ${empKey})`);
      continue;
    }

    await db.employee.update({
      where: { id: empId },
      data: { managerId },
    });
    managersSet++;
  }

  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/settings");

  return NextResponse.json({
    success: true,
    titlesCreated,
    employeesUpdated: updated,
    employeesNotFound: notFound,
    managersSet,
    log,
  });
}
