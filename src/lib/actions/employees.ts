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

  // Show employees with a user account OR in PENDING status (pending don't have accounts yet)
  const searchOR = where.OR;
  delete where.OR;

  const conditions: Record<string, unknown>[] = [
    { ...where, user: { isNot: null } },
    { ...where, status: "PENDING" },
  ];

  const finalWhere: Record<string, unknown> = { OR: conditions };
  if (searchOR) {
    finalWhere.AND = [{ OR: searchOR }];
  }

  return db.employee.findMany({
    where: finalWhere,
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

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Only create user account and send welcome email for non-ONBOARDING employees
  // ONBOARDING employees get their welcome via the onboarding flow below
  if (status !== "ONBOARDING") {
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
      await db.user.update({
        where: { id: existingUser.id },
        data: { employeeId: employee.id },
      });
    }

    // Send welcome email once
    sendWelcomeEmail({
      to: data.email,
      role: "Employee",
      loginUrl: `${baseUrl}/login`,
    });
  }

  // If onboarding, check for pre-onboarding tasks first
  if (status === "ONBOARDING") {
    const { resolveOnboardingTasks, resolvePreOnboardingTasks } = await import("./onboarding-resolution");
    const { createSigningRequest } = await import("./signing");
    const { sendSigningRequestEmail, sendTaskAssignmentEmail } = await import("@/lib/email");

    const preOnboardingTasks = await resolvePreOnboardingTasks(employee.departmentId, employee.jobTitle);

    if (preOnboardingTasks.length > 0) {
      // Has pre-onboarding tasks — set status to PRE_ONBOARDING and assign those
      await db.employee.update({ where: { id: employee.id }, data: { status: "PRE_ONBOARDING" } });
      employee.status = "PRE_ONBOARDING";

      for (const task of preOnboardingTasks) {
        await db.employeeTask.create({
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
      }
      revalidatePath("/onboarding");
      revalidatePath("/people");
      revalidatePath("/org");
      return employee;
    }

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
  type: "PRE_ONBOARDING" | "ONBOARDING" | "OFFBOARDING"
) {
  const typeLabel = type === "PRE_ONBOARDING" ? "Pre-Onboarding" : type === "ONBOARDING" ? "Onboarding" : "Offboarding";
  // Find or create a checklist for custom tasks
  let checklist = await db.onboardingChecklist.findFirst({
    where: { name: `Custom ${typeLabel} Tasks`, type },
  });
  if (!checklist) {
    checklist = await db.onboardingChecklist.create({
      data: { name: `Custom ${typeLabel} Tasks`, type },
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

export async function completePreOnboarding(employeeId: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  // Transition to ONBOARDING
  await db.employee.update({
    where: { id: employeeId },
    data: { status: "ONBOARDING" },
  });

  // Create user account if missing (pre-onboarding hires skip user creation)
  const existingUser = await db.user.findFirst({ where: { employeeId } });
  if (!existingUser) {
    const userByEmail = await db.user.findUnique({ where: { email: employee.email } });
    if (!userByEmail) {
      await db.user.create({
        data: {
          email: employee.email,
          role: "EMPLOYEE",
          employeeId: employee.id,
        },
      });
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      try {
        await sendWelcomeEmail({
          to: employee.email,
          role: "Employee",
          loginUrl: `${baseUrl}/login`,
        });
      } catch (e) {
        console.error("[pre-onboarding] Failed to send welcome email:", e);
      }
    } else if (!userByEmail.employeeId) {
      await db.user.update({
        where: { id: userByEmail.id },
        data: { employeeId: employee.id },
      });
    }
  }

  // Resolve and assign regular onboarding tasks
  const { resolveOnboardingTasks } = await import("./onboarding-resolution");
  const { createSigningRequest } = await import("./signing");
  const { sendSigningRequestEmail, sendTaskAssignmentEmail } = await import("@/lib/email");
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const resolvedTasks = await resolveOnboardingTasks(employee.departmentId, employee.jobTitle);

  for (const task of resolvedTasks) {
    const employeeTask = await db.employeeTask.create({
      data: {
        employeeId,
        checklistItemId: task.checklistItemId,
        title: task.title,
        description: task.description,
        documentAction: task.documentAction,
        documentUrl: task.documentUrl,
        documentName: task.documentName,
        assigneeId: task.assigneeId,
      },
    });

    if (task.documentAction === "SIGN" && task.documentUrl && task.documentName) {
      const signingReq = await createSigningRequest(
        employeeTask.id,
        employeeId,
        task.documentUrl,
        task.documentName
      );
      sendSigningRequestEmail({
        to: employee.email,
        firstName: employee.firstName,
        documentName: task.documentName,
        signingUrl: `${baseUrl}/sign/${signingReq.token}`,
      });
    }

    if (task.assigneeId) {
      const assignee = await db.employee.findUnique({ where: { id: task.assigneeId } });
      if (assignee) {
        sendTaskAssignmentEmail({
          to: assignee.email,
          assigneeName: assignee.firstName,
          newHireName: `${employee.firstName} ${employee.lastName}`,
          taskTitle: task.title,
          taskDescription: task.description,
        });
      }
    }
  }

  revalidatePath("/onboarding");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  return employee;
}

export async function completeOnboarding(employeeId: string) {
  const employee = await db.employee.update({
    where: { id: employeeId },
    data: { status: "ACTIVE" },
  });

  // Ensure the employee has a user account (may be missing if they came through pre-onboarding)
  const existingUser = await db.user.findFirst({
    where: { employeeId },
  });
  if (!existingUser) {
    const userByEmail = await db.user.findUnique({ where: { email: employee.email } });
    if (!userByEmail) {
      await db.user.create({
        data: {
          email: employee.email,
          role: "EMPLOYEE",
          employeeId: employee.id,
        },
      });
      // Send welcome email
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      try {
        await sendWelcomeEmail({
          to: employee.email,
          role: "Employee",
          loginUrl: `${baseUrl}/login`,
        });
      } catch (e) {
        console.error("[onboarding] Failed to send welcome email:", e);
      }
    } else if (!userByEmail.employeeId) {
      await db.user.update({
        where: { id: userByEmail.id },
        data: { employeeId: employee.id },
      });
    }
  }

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

  // Clean up chat data (chat relations don't cascade on Employee delete)
  try {
    await db.reaction.deleteMany({ where: { employeeId: id } });
    await db.savedMessage.deleteMany({ where: { employeeId: id } });
    await db.pinnedMessage.deleteMany({ where: { pinnedById: id } });
    await db.message.deleteMany({ where: { authorId: id } });
    await db.channelMember.deleteMany({ where: { employeeId: id } });
    await db.dmMember.deleteMany({ where: { employeeId: id } });
    await db.chatMember.deleteMany({ where: { employeeId: id } });
    // These models may be added in later phases
    // await db.chatNotification.deleteMany({ where: { employeeId: id } });
    // await db.messageDraft.deleteMany({ where: { employeeId: id } });
    // await db.reminder.deleteMany({ where: { employeeId: id } });
  } catch {
    // Chat tables may not exist yet
  }

  // Clean up other relations (some cascade via onDelete, but clean explicitly to be safe)
  try {
    await db.feedReaction.deleteMany({ where: { employeeId: id } });
    await db.feedComment.deleteMany({ where: { authorId: id } });
    await db.feedPost.deleteMany({ where: { authorId: id } });
    await db.clubMember.deleteMany({ where: { employeeId: id } });
    await db.pulseResponse.deleteMany({ where: { employeeId: id } });
    await db.timeOffRequest.deleteMany({ where: { employeeId: id } });
    await db.timeOffBalance.deleteMany({ where: { employeeId: id } });
    await db.notification.deleteMany({ where: { recipientId: id } });
  } catch {
    // Ignore if any fail
  }

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
    reportsTo?: string;
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

  // Track created employee IDs + their reportsTo names for second pass
  const createdEmployees: { id: string; email: string; firstName: string; lastName: string; reportsTo?: string }[] = [];

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

      // Generate a unique pending email if none provided
      let email = emp.email;
      if (!email) {
        const base = `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase().replace(/\s+/g, '')}`;
        email = `${base}@pending.local`;
        const existingPending = await db.employee.findUnique({ where: { email } });
        if (existingPending) {
          skipped.push(`${emp.firstName} ${emp.lastName} (already imported)`);
          continue;
        }
      }

      const newEmp = await db.employee.create({
        data: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          email,
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
      createdEmployees.push({
        id: newEmp.id,
        email: newEmp.email,
        firstName: newEmp.firstName,
        lastName: newEmp.lastName,
        reportsTo: emp.reportsTo,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Failed to import ${emp.email || emp.firstName + ' ' + emp.lastName}: ${message}`);
    }
  }

  // Second pass: resolve "Reports To" names to manager IDs
  const managerCache: Record<string, string | null> = {};
  for (const emp of createdEmployees) {
    if (!emp.reportsTo) continue;
    const managerName = emp.reportsTo.trim();
    if (!managerName) continue;

    if (!(managerName in managerCache)) {
      // Try to find manager by name (first + last)
      const parts = managerName.split(/\s+/);
      let manager = null;
      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        manager = await db.employee.findFirst({
          where: {
            firstName: { equals: firstName, mode: "insensitive" },
            lastName: { equals: lastName, mode: "insensitive" },
          },
          select: { id: true },
        });
      }
      if (!manager) {
        // Fallback: search by full name in either order
        manager = await db.employee.findFirst({
          where: {
            OR: [
              { firstName: { contains: parts[0], mode: "insensitive" } },
              { lastName: { contains: parts[0], mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });
      }
      managerCache[managerName] = manager?.id || null;
    }

    const managerId = managerCache[managerName];
    if (managerId) {
      await db.employee.update({
        where: { id: emp.id },
        data: { managerId },
      });
    } else {
      errors.push(`Could not find manager "${managerName}" for ${emp.firstName} ${emp.lastName}`);
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
