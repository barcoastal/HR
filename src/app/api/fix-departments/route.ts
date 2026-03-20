import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const EMPLOYEE_DEPTS: Record<string, string> = {
  "julio@coastaldebt.com": "Customer Support",
  "calvarez@coastaldebt.com": "Customer Support",
  "marquez@coastaldebt.com": "Customer Support",
  "rclayton@coastaldebt.com": "Customer Support",
  "alecha@coastaldebt.com": "Customer Support",
  "yeislee@coastaldebt.com": "Customer Support",
  "rgalindo@coastaldebt.com": "Customer Support",
  "mglave@coastaldebt.com": "Customer Support",
  "david@coastaldebt.com": "Customer Support",
  "smedina@coastaldebt.com": "Customer Support",
  "ferron@coastaldebt.com": "Customer Support",
  "timr@coastaldebt.com": "Customer Support",
  "carlos@coastaldebt.com": "Customer Support",
  "ssimpson@coastaldebt.com": "Customer Support",
  "sandra@coastaldebt.com": "Human Resource",
  "dgaren@coastaldebt.com": "Human Resource",
  "jlanglois@coastaldebt.com": "Human Resource",
  "alexis@coastaldebt.com": "Human Resource",
  "rlowe@coastaldebt.com": "Marketing",
  "ssweet@coastaldebt.com": "Sales",
  "daflalo@coastaldebt.com": "Sales - Closers",
  "cayala@coastaldebt.com": "Sales - Closers",
  "zachary@coastaldebt.com": "Sales - Closers",
  "echase@coastaldebt.com": "Sales - Closers",
  "cohen@coastaldebt.com": "Sales - Closers",
  "chunter@coastaldebt.com": "Sales - Closers",
  "zane.kerns@coastaldebt.com": "Sales - Closers",
  "jlimongi@coastaldebt.com": "Sales - Closers",
  "tpalmer@coastaldebt.com": "Sales - Closers",
  "redick@coastaldebt.com": "Sales - Closers",
  "lreed@coastaldebt.com": "Sales - Closers",
  "asaenz@coastaldebt.com": "Sales - Closers",
  "nathant@coastaldebt.com": "Sales - Closers",
  "rallen@coastaldebt.com": "Sales - Openers",
  "gausby@coastaldebt.com": "Sales - Openers",
  "abell@coastaldebt.com": "Sales - Openers",
  "harrod@coastaldebt.com": "Sales - Openers",
  "dbermudez@coastaldebt.com": "Sales - Openers",
  "cchristy@coastaldebt.com": "Sales - Openers",
  "fernando@coastaldebt.com": "Sales - Openers",
  "jdouyon@coastaldebt.com": "Sales - Openers",
  "sjohnson@coastaldebt.com": "Sales - Openers",
  "alloyd@coastaldebt.com": "Sales - Openers",
  "smahabir@coastaldebt.com": "Sales - Openers",
  "cmcdowell@coastaldebt.com": "Sales - Openers",
  "jmercado@coastaldebt.com": "Sales - Openers",
  "lmesquita@coastaldebt.com": "Sales - Openers",
  "kmobley@coastaldebt.com": "Sales - Openers",
  "jacques@coastaldebt.com": "Sales - Openers",
  "nnicolas@coastaldebt.com": "Sales - Openers",
  "lionel@coastaldebt.com": "Sales - Openers",
  "mrabin@coastaldebt.com": "Sales - Openers",
  "jrivera@coastaldebt.com": "Sales - Openers",
  "nsantu@coastaldebt.com": "Sales - Openers",
  "lwheatle@coastaldebt.com": "Sales - Openers",
  "awilson@coastaldebt.com": "Sales - Openers",
  "nwilson@coastaldebt.com": "Sales - Openers",
  "ronnie@coastaldebt.com": "Sales - Openers",
  "awright@coastaldebt.com": "Sales - Openers",
  "dyoun@coastaldebt.com": "Sales - Openers",
};

// Name-based for employees without email
const NAME_DEPTS: Record<string, string> = {
  "Ann Pierre-Pierre": "Customer Support",
  "Angie Wilson": "Customer Support",
  "Allison Biscardi": "General & Admin",
  "Shachar Matmon": "General & Admin",
  "Christopher Boulahanis": "Sales - Closers",
  "Shlomo Mor-Josef": "Sales - Closers",
  "Monique Coleman": "Sales - Openers",
  "Garett Davis": "Sales - Openers",
  "Anais Hernandez": "Sales - Openers",
  "Tedd Lee": "Sales - Openers",
  "Cindy Romanczak": "Sales - Openers",
};

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== "coastal-sync-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];

  // Build department cache
  const deptCache: Record<string, string> = {};
  const allDepts = await db.department.findMany();
  for (const d of allDepts) {
    deptCache[d.name.toLowerCase()] = d.id;
  }
  log.push(`Departments found: ${allDepts.map(d => `${d.name} (${d.id})`).join(", ")}`);

  // Fix by email
  let fixed = 0;
  for (const [email, deptName] of Object.entries(EMPLOYEE_DEPTS)) {
    const deptId = deptCache[deptName.toLowerCase()];
    if (!deptId) {
      log.push(`Dept not found: ${deptName}`);
      continue;
    }
    const emp = await db.employee.findUnique({ where: { email } });
    if (!emp) {
      log.push(`Employee not found: ${email}`);
      continue;
    }
    if (emp.departmentId !== deptId) {
      await db.employee.update({ where: { id: emp.id }, data: { departmentId: deptId } });
      log.push(`Fixed ${email}: ${emp.departmentId} → ${deptId} (${deptName})`);
      fixed++;
    }
  }

  // Fix by name
  for (const [name, deptName] of Object.entries(NAME_DEPTS)) {
    const deptId = deptCache[deptName.toLowerCase()];
    if (!deptId) continue;
    const [firstName, ...lastParts] = name.split(" ");
    const lastName = lastParts.join(" ");
    const emp = await db.employee.findFirst({
      where: {
        firstName: { equals: firstName, mode: "insensitive" },
        lastName: { equals: lastName, mode: "insensitive" },
      },
    });
    if (!emp) {
      log.push(`Employee not found by name: ${name}`);
      continue;
    }
    if (emp.departmentId !== deptId) {
      await db.employee.update({ where: { id: emp.id }, data: { departmentId: deptId } });
      log.push(`Fixed ${name}: → ${deptName}`);
      fixed++;
    }
  }

  revalidatePath("/org");
  revalidatePath("/org/departments");
  revalidatePath("/people");

  return NextResponse.json({ success: true, fixed, log });
}
