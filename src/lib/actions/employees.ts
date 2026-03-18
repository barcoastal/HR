"use server";

import { db } from "@/lib/db";
import type { EmployeeStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { sendOnboardingEmail, sendWelcomeEmail } from "@/lib/email";

export async function getEmployees(filters?: {
  search?: string;
  department?: string;
  status?: EmployeeStatus;
}) {
  const where: Record<string, unknown> = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.department && filters.department !== "All") {
    where.department = { name: filters.department };
  }

  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search } },
      { lastName: { contains: filters.search } },
      { jobTitle: { contains: filters.search } },
      { email: { contains: filters.search } },
    ];
  }

  // Only show employees who have an associated user account
  where.user = { isNot: null };

  return db.employee.findMany({
    where,
    include: { department: true, team: true },
    orderBy: { firstName: "asc" },
  });
}

export async function getEmployeeById(id: string) {
  return db.employee.findUnique({
    where: { id },
    include: {
      department: true,
      team: true,
      manager: true,
      buddy: true,
      directReports: true,
      documents: true,
      reviewsAsEmployee: {
        include: { reviewer: true, cycle: true },
        orderBy: { createdAt: "desc" },
      },
      employeeTasks: {
        include: { checklistItem: { include: { checklist: true } } },
      },
    },
  });
}

export async function createEmployee(data: {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentId?: string;
  teamId?: string;
  managerId?: string;
  startDate: string;
  phone?: string;
  birthday?: string;
  location?: string;
  dietaryRestrictions?: string;
  bio?: string;
  hobbies?: string;
  status?: EmployeeStatus;
}) {
  const status = data.status || "ACTIVE";
  const employee = await db.employee.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      birthday: data.birthday ? new Date(data.birthday) : null,
      anniversaryDate: new Date(data.startDate),
      status,
    },
  });

  // Send welcome email and create user account for the new employee
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create a User account so they can log in (skip if one already exists for this email)
  const existingUser = await db.user.findUnique({ where: { email: data.email } });
  if (!existingUser) {
    await db.user.create({
      data: {
        email: data.email,
        role: "EMPLOYEE",
        employeeId: employee.id,
      },
    });
    revalidatePath("/settings");
  } else if (!existingUser.employeeId) {
    // Link existing user to the new employee record
    await db.user.update({
      where: { id: existingUser.id },
      data: { employeeId: employee.id },
    });
  }

  // Send welcome email
  sendWelcomeEmail({
    to: data.email,
    role: "Employee",
    loginUrl: `${baseUrl}/login`,
  });

  // If onboarding, resolve and create tasks
  if (status === "ONBOARDING") {
    const { resolveOnboardingTasks } = await import("./onboarding-resolution");
    const { createSigningRequest } = await import("./signing");
    const { sendSigningRequestEmail, sendTaskAssignmentEmail } = await import("@/lib/email");

    const resolvedTasks = await resolveOnboardingTasks(employee.departmentId, employee.jobTitle);

    for (const task of resolvedTasks) {
      const employeeTask = await db.employeeTask.create({
        data: {
          employeeId: employee.id,
          checklistItemId: task.checklistItemId,
          title: task.title,
          description: task.description,
          documentAction: task.documentAction,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
          assigneeId: task.assigneeId,
        },
      });

      // Handle document actions
      if (task.documentAction === "SEND" && task.sendEmail && task.emailSubject && task.emailBody) {
        sendOnboardingEmail({
          to: data.email,
          subject: task.emailSubject,
          body: task.emailBody,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
        });
      } else if (task.documentAction === "SIGN" && task.documentUrl && task.documentName) {
        const signingReq = await createSigningRequest(
          employeeTask.id,
          employee.id,
          task.documentUrl,
          task.documentName
        );
        sendSigningRequestEmail({
          to: data.email,
          firstName: data.firstName,
          documentName: task.documentName,
          signingUrl: `${baseUrl}/sign/${signingReq.token}`,
        });
      } else if (task.sendEmail && task.emailSubject && task.emailBody) {
        sendOnboardingEmail({
          to: data.email,
          subject: task.emailSubject,
          body: task.emailBody,
        });
      }

      // Notify assigned employee
      if (task.assigneeId) {
        const assignee = await db.employee.findUnique({ where: { id: task.assigneeId } });
        if (assignee) {
          sendTaskAssignmentEmail({
            to: assignee.email,
            assigneeName: assignee.firstName,
            newHireName: `${data.firstName} ${data.lastName}`,
            taskTitle: task.title,
            taskDescription: task.description,
          });
        }
      }
    }
    revalidatePath("/onboarding");
  }

  revalidatePath("/people");
  revalidatePath("/org");
  return employee;
}

export async function updateEmployee(
  id: string,
  data: Record<string, unknown>
) {
  const { startDate, birthday, ...rest } = data;
  const employee = await db.employee.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate as string) } : {}),
      ...(birthday ? { birthday: new Date(birthday as string) } : {}),
    },
  });
  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  return employee;
}

export async function startOffboarding(employeeId: string, endDate: string) {
  const offboardingChecklists = await db.onboardingChecklist.findMany({
    where: { type: "OFFBOARDING" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const allChecklistItems = offboardingChecklists.flatMap((c) => c.items);

  const employee = await db.employee.update({
    where: { id: employeeId },
    data: {
      status: "OFFBOARDED",
      endDate: new Date(endDate),
    },
  });

  if (allChecklistItems.length > 0) {
    await db.employeeTask.createMany({
      data: allChecklistItems.map((item) => ({
        employeeId: employee.id,
        checklistItemId: item.id,
        status: "PENDING",
      })),
    });
  }

  revalidatePath("/people");
  revalidatePath("/offboarding");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");

  return { employee, taskCount: allChecklistItems.length };
}

export async function setEmployeeManager(employeeId: string, managerId: string | null) {
  const employee = await db.employee.update({
    where: { id: employeeId },
    data: { managerId },
  });
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  return employee;
}

export async function toggleEmployeeTask(taskId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const task = await db.employeeTask.findUnique({
    where: { id: taskId },
    include: { employee: true },
  });
  if (!task) return null;

  // Allow: assigned employee, manager of the new hire, or admin
  const userEmployeeId = session.user?.employeeId;
  const isAssignee = task.assigneeId && task.assigneeId === userEmployeeId;
  const isManager = task.employee.managerId === userEmployeeId;
  const isAdmin = session.user?.role === "SUPER_ADMIN" || session.user?.role === "ADMIN" || session.user?.role === "HR";
  if (!isAssignee && !isManager && !isAdmin) {
    throw new Error("Not authorized to update this task");
  }

  const updated = await db.employeeTask.update({
    where: { id: taskId },
    data: {
      status: task.status === "DONE" ? "PENDING" : "DONE",
      completedAt: task.status === "DONE" ? null : new Date(),
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
  revalidatePath(`/people/${task.employeeId}`);
  return updated;
}

export async function addEmployeeTask(employeeId: string, checklistItemId: string) {
  const task = await db.employeeTask.create({
    data: { employeeId, checklistItemId, status: "PENDING" },
  });
  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
  return task;
}

export async function addCustomEmployeeTask(
  employeeId: string,
  title: string,
  description: string | undefined,
  type: "ONBOARDING" | "OFFBOARDING"
) {
  // Find or create a checklist for custom tasks
  let checklist = await db.onboardingChecklist.findFirst({
    where: { name: `Custom ${type === "ONBOARDING" ? "Onboarding" : "Offboarding"} Tasks`, type },
  });
  if (!checklist) {
    checklist = await db.onboardingChecklist.create({
      data: { name: `Custom ${type === "ONBOARDING" ? "Onboarding" : "Offboarding"} Tasks`, type },
    });
  }

  const maxOrder = await db.checklistItem.findFirst({
    where: { checklistId: checklist.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const checklistItem = await db.checklistItem.create({
    data: {
      checklistId: checklist.id,
      title,
      description: description || null,
      order: (maxOrder?.order ?? -1) + 1,
    },
  });

  const task = await db.employeeTask.create({
    data: { employeeId, checklistItemId: checklistItem.id, status: "PENDING" },
  });

  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
  revalidatePath("/settings");
  return task;
}

export async function completeOnboarding(employeeId: string) {
  const employee = await db.employee.update({
    where: { id: employeeId },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/onboarding");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  return employee;
}

export async function deleteEmployee(id: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to delete employees");
  }

  // Unlink manager/buddy/department head references
  await db.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
  await db.employee.updateMany({ where: { buddyId: id }, data: { buddyId: null } });
  await db.department.updateMany({ where: { headId: id }, data: { headId: null } });

  // Unlink/delete user account
  await db.user.deleteMany({ where: { employeeId: id } });

  // Cascade handles: employeeTasks, signingRequests, reviews, documents, hrNotes, etc.
  await db.employee.delete({ where: { id } });

  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/org/departments");
  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
}

export async function bulkImportEmployees(
  employees: {
    firstName: string;
    lastName: string;
    email?: string;
    jobTitle?: string;
    phone?: string;
    departmentId?: string;
    departmentName?: string;
    managerId?: string;
    startDate?: string;
    location?: string;
  }[]
): Promise<{ created: number; skipped: string[]; errors: string[] }> {
  let created = 0;
  const skipped: string[] = [];
  const errors: string[] = [];

  // Cache department lookups to avoid repeated DB queries
  const deptCache: Record<string, string> = {};

  async function resolveDepartmentId(emp: typeof employees[0]): Promise<string | null> {
    if (emp.departmentId) return emp.departmentId;
    if (!emp.departmentName) return null;

    const name = emp.departmentName.trim();
    if (deptCache[name]) return deptCache[name];

    // Try to find existing department (case-insensitive)
    let dept = await db.department.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (!dept) {
      dept = await db.department.create({ data: { name } });
    }

    deptCache[name] = dept.id;
    return dept.id;
  }

  for (const emp of employees) {
    try {
      // Skip duplicates by email if email is provided
      if (emp.email) {
        const existing = await db.employee.findUnique({ where: { email: emp.email } });
        if (existing) {
          skipped.push(emp.email);
          continue;
        }
      }

      const departmentId = await resolveDepartmentId(emp);

      await db.employee.create({
        data: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email || `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase().replace(/\s+/g, '')}@pending.local`,
          jobTitle: emp.jobTitle || "Employee",
          phone: emp.phone || null,
          departmentId,
          managerId: emp.managerId || null,
          startDate: emp.startDate ? new Date(emp.startDate) : new Date(),
          anniversaryDate: emp.startDate ? new Date(emp.startDate) : new Date(),
          location: emp.location || null,
          status: "PENDING",
        },
      });
      created++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to import ${emp.email || emp.firstName + ' ' + emp.lastName}: ${message}`);
    }
  }

  revalidatePath("/people");
  revalidatePath("/org");
  return { created, skipped, errors };
}

export async function approveAndInviteEmployee(employeeId: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "PENDING") throw new Error("Employee is not pending");

  await db.employee.update({
    where: { id: employeeId },
    data: { status: "ACTIVE" },
  });

  // Create user account
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const existingUser = await db.user.findUnique({ where: { email: employee.email } });
  if (!existingUser) {
    await db.user.create({
      data: {
        email: employee.email,
        role: "EMPLOYEE",
        employeeId: employee.id,
      },
    });
  } else if (!existingUser.employeeId) {
    await db.user.update({
      where: { id: existingUser.id },
      data: { employeeId: employee.id },
    });
  }

  // Send welcome email
  sendWelcomeEmail({
    to: employee.email,
    role: "Employee",
    loginUrl: `${baseUrl}/login`,
  });

  revalidatePath("/people");
  revalidatePath("/org");
  revalidatePath("/settings");
  return employee;
}

export async function bulkApproveAndInviteEmployees(employeeIds: string[]) {
  let approved = 0;
  const errors: string[] = [];

  for (const id of employeeIds) {
    try {
      await approveAndInviteEmployee(id);
      approved++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${id}: ${message}`);
    }
  }

  revalidatePath("/people");
  revalidatePath("/org");
  return { approved, errors };
}
