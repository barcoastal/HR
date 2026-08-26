"use server";

import { db } from "@/lib/db";
import type { EmployeeStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { sendOnboardingEmail, sendWelcomeEmail } from "@/lib/email";
import { isJobTitleEligibleForTraining } from "@/lib/training-eligibility-server";

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
    include: {
      department: true,
      team: true,
      manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
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
  const { audit } = await import("@/lib/audit");
  await audit({
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    details: { name: `${employee.firstName} ${employee.lastName}`, email: employee.email, status },
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
    const { sendSigningRequestEmail } = await import("@/lib/email");

    const preOnboardingTasks = await resolvePreOnboardingTasks(employee.departmentId, employee.jobTitle);

    if (preOnboardingTasks.length > 0) {
      // Written Offer documents must finish before internal Onboarding begins.
      await db.employee.update({ where: { id: employee.id }, data: { status: "PRE_ONBOARDING" } });
      employee.status = "PRE_ONBOARDING";

      const { assignWrittenOfferTasks, maybeAdvanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
      await assignWrittenOfferTasks(employee, preOnboardingTasks);
      await maybeAdvanceWrittenOfferToOnboarding(employee.id);
      revalidatePath("/onboarding");
      revalidatePath("/pre-onboarding");
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
          assigneeDepartmentId: task.assigneeDepartmentId,
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
      } else if ((task.documentAction === "SIGN" || task.documentAction === "FILL") && task.documentUrl && task.documentName) {
        // Route to assignee or external address when documentRecipient is overridden
        let recipientEmail = data.email;
        let recipientFirstName = data.firstName;
        let recipientEmployeeId = employee.id;
        if (task.documentRecipient === "ASSIGNEE" && task.assigneeId) {
          const assignee = await db.employee.findUnique({
            where: { id: task.assigneeId },
            select: { id: true, email: true, firstName: true },
          });
          if (assignee) {
            recipientEmail = assignee.email;
            recipientFirstName = assignee.firstName;
            recipientEmployeeId = assignee.id;
          }
        } else if (task.documentRecipient === "EXTERNAL" && task.externalEmail) {
          // External recipient — still create the signing request under the employee
          // (for tracking/audit) but email goes to the outside address.
          recipientEmail = task.externalEmail;
          recipientFirstName = task.externalName || "there";
        }
        const req = await createSigningRequest(
          employeeTask.id,
          recipientEmployeeId,
          task.documentUrl,
          task.documentName
        );
        if (task.documentAction === "SIGN") {
          sendSigningRequestEmail({
            to: recipientEmail,
            firstName: recipientFirstName,
            documentName: task.documentName,
            signingUrl: `${baseUrl}/sign/${req.token}`,
          });
        } else {
          const { sendFillRequestEmail } = await import("@/lib/email");
          sendFillRequestEmail({
            to: recipientEmail,
            firstName: recipientFirstName,
            documentName: task.documentName,
            fillUrl: `${baseUrl}/fill/${req.token}`,
          });
        }
      } else if (task.sendEmail && task.emailSubject && task.emailBody) {
        sendOnboardingEmail({
          to: data.email,
          subject: task.emailSubject,
          body: task.emailBody,
        });
      }

      const { notifyTaskAssignment } = await import("@/lib/task-notifications");
      await notifyTaskAssignment({
        taskId: employeeTask.id,
        assigneeId: task.assigneeId,
        assigneeDepartmentId: task.assigneeDepartmentId,
        employeeName: `${data.firstName} ${data.lastName}`,
        taskTitle: task.title,
        taskDescription: task.description,
        workflow: "ONBOARDING",
      });
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
  const oldEmployee = data.email ? await db.employee.findUnique({ where: { id }, select: { email: true } }) : null;
  const employee = await db.employee.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate ? { startDate: new Date(startDate as string) } : {}),
      ...(birthday ? { birthday: new Date(birthday as string) } : {}),
    },
  });

  // Sync email change to User account so login still works
  if (data.email && oldEmployee && oldEmployee.email !== data.email) {
    const user = await db.user.findFirst({ where: { employeeId: id } });
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { email: data.email as string } });
    }
  }

  const { audit } = await import("@/lib/audit");
  await audit({
    action: "employee.updated",
    entityType: "employee",
    entityId: id,
    details: { fields: Object.keys(data) },
  });

  revalidatePath("/people");
  revalidatePath(`/people/${id}`);
  return employee;
}

export async function promoteEmployee(
  employeeId: string,
  newJobTitle: string,
  newDepartmentId?: string | null
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to promote employees");
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  if (!employee) throw new Error("Employee not found");

  const oldTitle = employee.jobTitle;
  const oldDeptName = employee.department?.name || null;

  // Update employee
  const updateData: Record<string, unknown> = { jobTitle: newJobTitle };
  if (newDepartmentId !== undefined) {
    updateData.departmentId = newDepartmentId || null;
  }
  await db.employee.update({ where: { id: employeeId }, data: updateData });
  {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "employee.promoted",
      entityType: "employee",
      entityId: employeeId,
      details: { from: oldTitle, to: newJobTitle, departmentChanged: newDepartmentId !== undefined },
    });
  }

  // Get new department name
  let newDeptName = oldDeptName;
  if (newDepartmentId && newDepartmentId !== employee.departmentId) {
    const newDept = await db.department.findUnique({
      where: { id: newDepartmentId },
      select: { name: true },
    });
    newDeptName = newDept?.name || null;
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const deptChanged = newDepartmentId && newDepartmentId !== employee.departmentId;

  // Build promotion message
  let promotionMessage = `${fullName} has been promoted to ${newJobTitle}`;
  if (deptChanged && newDeptName) {
    promotionMessage += ` in ${newDeptName}`;
  }
  promotionMessage += "!";

  // Create a PROMOTION feed post
  const promoterId = session.user?.employeeId;
  if (promoterId) {
    await db.feedPost.create({
      data: {
        authorId: promoterId,
        content: promotionMessage,
        type: "PROMOTION",
        mentionedEmployeeId: employeeId,
        notifyViaEmail: true,
        emailTargetType: "all",
      },
    });
  }

  // Notify all active employees (in-app) who opted in to promotion notifications
  const inAppUsers = await db.user.findMany({
    where: {
      employee: { status: "ACTIVE" },
      employeeId: { not: employeeId },
      notifyPromotionInApp: true,
    },
    select: { employeeId: true },
  });
  if (inAppUsers.length > 0) {
    await db.notification.createMany({
      data: inAppUsers
        .filter((u) => u.employeeId)
        .map((u) => ({
          recipientId: u.employeeId!,
          type: "PROMOTION",
          message: promotionMessage,
          link: `/people/${employeeId}`,
        })),
    });
  }

  // Send email to users who opted in
  const emailUsers = await db.user.findMany({
    where: {
      employee: { status: "ACTIVE" },
      emailNotificationsEnabled: true,
      notifyPromotionEmail: true,
    },
    select: { email: true },
  });
  if (emailUsers.length > 0) {
    try {
      const { sendFeedPostNotification } = await import("@/lib/email");
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const html = `<p style="margin:0 0 12px">${promotionMessage}</p><p style="margin:0 0 4px;color:#666">Previously: ${oldTitle}${oldDeptName ? ` in ${oldDeptName}` : ""}</p><p style="margin:16px 0 0"><a href="${baseUrl}/people/${employeeId}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">View Profile</a></p>`;
      await sendFeedPostNotification(
        emailUsers.map((u) => u.email),
        `${fullName} has been promoted!`,
        html
      );
    } catch (err) {
      console.error("[promote] email notification error:", err);
    }
  }

  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/");
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
        title: item.title,
        description: item.description,
        assigneeId: item.assigneeId,
        documentAction: item.documentAction,
        documentUrl: item.documentUrl,
        documentName: item.documentName,
      })),
    });
  }

  // Deactivate the login for every role: sign-in is refused, open sessions end on
  // their next request, and the email sender suppresses anything addressed to them.
  await db.user.updateMany({
    where: { OR: [{ employeeId }, { email: { equals: employee.email, mode: "insensitive" } }] },
    data: { deactivatedAt: new Date() },
  });

  const { audit } = await import("@/lib/audit");
  await audit({
    action: "employee.offboarding_started",
    entityType: "employee",
    entityId: employeeId,
    details: { endDate, taskCount: allChecklistItems.length },
  });

  // Notify the configured Management (and any other enabled recipients) group
  try {
    const { sendNotifications } = await import("@/lib/notifications/send");
    const fullName = `${employee.firstName} ${employee.lastName}`;
    const dept = employee.departmentId
      ? await db.department.findUnique({
          where: { id: employee.departmentId },
          select: { name: true },
        })
      : null;
    const endDateStr = new Date(endDate).toLocaleDateString();
    await sendNotifications({
      action: "EMPLOYEE_OFFBOARDING",
      employeeId,
      message: `${fullName} has started offboarding (last day ${endDateStr})`,
      link: `/people/${employeeId}`,
      emailSubject: `Offboarding started: ${fullName}`,
      emailBody: `<p><strong>${fullName}</strong>${dept?.name ? ` (${dept.name})` : ""} has been marked for offboarding.</p><p>Last day: <strong>${endDateStr}</strong></p>`,
    });
  } catch (err) {
    console.error("[offboarding] Failed to send notifications:", err);
  }

  revalidatePath("/people");
  revalidatePath("/offboarding");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  revalidatePath("/settings");

  return { employee, taskCount: allChecklistItems.length };
}

export async function reactivateEmployee(employeeId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to reactivate employees");
  }

  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "OFFBOARDED") {
    throw new Error("Only offboarded employees can be reactivated");
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { status: "ACTIVE", endDate: null },
  });

  // Re-enable the login (and re-link it if an older offboarding detached it).
  await db.user.updateMany({
    where: { OR: [{ employeeId }, { email: { equals: employee.email, mode: "insensitive" } }] },
    data: { deactivatedAt: null },
  });
  // If startOffboarding detached their user account, try to re-link by email.
  const detachedUser = await db.user.findFirst({
    where: { email: employee.email, employeeId: null },
  });
  if (detachedUser) {
    await db.user.update({
      where: { id: detachedUser.id },
      data: { employeeId },
    });
  }

  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/offboarding");
  revalidatePath("/org");
}

export async function setEmployeeManager(employeeId: string, managerId: string | null) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to change managers");
  }

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
    include: { employee: true, signingRequest: true },
  });
  if (!task) return null;

  // Allow: assigned employee, manager of the new hire, or admin
  const userEmployeeId = session.user?.employeeId;
  const isAssignee = task.assigneeId && task.assigneeId === userEmployeeId;
  const viewer = userEmployeeId
    ? await db.employee.findUnique({ where: { id: userEmployeeId }, select: { departmentId: true } })
    : null;
  const isAssignedDepartment = Boolean(
    task.assigneeDepartmentId
    && viewer?.departmentId === task.assigneeDepartmentId
  );
  const isManager = task.employee.managerId === userEmployeeId;
  const isAdmin = session.user?.role === "SUPER_ADMIN" || session.user?.role === "ADMIN" || session.user?.role === "HR";
  if (!isAssignee && !isAssignedDepartment && !isManager && !isAdmin) {
    throw new Error("Not authorized to update this task");
  }

  const isIncompleteWrittenOfferDocument =
    task.employee.status === "PRE_ONBOARDING" &&
    task.status !== "DONE" &&
    (task.documentAction === "SIGN" || task.documentAction === "FILL") &&
    task.signingRequest?.status !== "SIGNED";
  if (isIncompleteWrittenOfferDocument) {
    throw new Error("This document is completed automatically after the recipient signs or fills it.");
  }

  const updated = await db.employeeTask.update({
    where: { id: taskId },
    data: {
      status: task.status === "DONE" ? "PENDING" : "DONE",
      completedAt: task.status === "DONE" ? null : new Date(),
      completedById: task.status === "DONE" ? null : userEmployeeId || null,
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/training");
  revalidatePath("/my-tasks");
  revalidatePath("/offboarding");
  revalidatePath("/pre-onboarding");
  revalidatePath(`/people/${task.employeeId}`);

  if (updated.status === "DONE" && task.employee.status === "PRE_ONBOARDING") {
    const { maybeAdvanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
    await maybeAdvanceWrittenOfferToOnboarding(task.employeeId);
  }
  return updated;
}

export async function addEmployeeTask(employeeId: string, checklistItemId: string) {
  await (await import("@/lib/auth-helpers")).requireAdmin();
  const [item, employee] = await Promise.all([
    db.checklistItem.findUnique({ where: { id: checklistItemId }, include: { checklist: true } }),
    db.employee.findUnique({ where: { id: employeeId } }),
  ]);

  if (item && employee?.status === "PRE_ONBOARDING") {
    const { assignWrittenOfferTasks, maybeAdvanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
    const [writtenOfferTask] = await assignWrittenOfferTasks(employee, [{
      checklistItemId: item.id,
      title: item.title,
      description: item.description,
      order: item.order,
      dueDay: item.dueDay,
      assigneeId: item.assigneeId,
      assigneeDepartmentId: item.assigneeDepartmentId,
      documentAction: item.documentAction,
      documentUrl: item.documentUrl,
      documentName: item.documentName,
      documentRecipient: item.documentRecipient,
      externalEmail: item.externalEmail,
      externalName: item.externalName,
      sendEmail: item.sendEmail,
      emailSubject: item.emailSubject,
      emailBody: item.emailBody,
    }]);
    await maybeAdvanceWrittenOfferToOnboarding(employeeId);
    return writtenOfferTask || null;
  }

  const task = await db.employeeTask.create({
    data: {
      employeeId,
      checklistItemId,
      status: "PENDING",
      title: item?.title || undefined,
      description: item?.description || undefined,
      assigneeId: item?.assigneeId || undefined,
      assigneeDepartmentId: item?.assigneeDepartmentId || undefined,
      documentAction: item?.documentAction || undefined,
      documentUrl: item?.documentUrl || undefined,
      documentName: item?.documentName || undefined,
    },
  });
  if (item && employee) {
    const { notifyTaskAssignment } = await import("@/lib/task-notifications");
    await notifyTaskAssignment({
      taskId: task.id,
      assigneeId: item.assigneeId,
      assigneeDepartmentId: item.assigneeDepartmentId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      taskTitle: item.title,
      taskDescription: item.description,
      workflow: item.checklist.type,
    });
  }
  revalidatePath("/onboarding");
  revalidatePath("/training");
  revalidatePath("/my-tasks");
  revalidatePath("/offboarding");
  revalidatePath("/pre-onboarding");
  return task;
}

export async function addCustomEmployeeTask(
  employeeId: string,
  title: string,
  description: string | undefined,
  type: "PRE_ONBOARDING" | "TRAINING" | "ONBOARDING" | "OFFBOARDING",
  assigneeId?: string,
  assigneeDepartmentId?: string
) {
  await (await import("@/lib/auth-helpers")).requireAdmin();
  const typeLabel = type === "PRE_ONBOARDING"
    ? "Written Offer"
    : type === "TRAINING"
      ? "Training"
      : type === "ONBOARDING"
        ? "Onboarding"
        : "Offboarding";
  // Find or create a checklist for custom tasks
  let checklist = await db.onboardingChecklist.findFirst({
    where: { name: `Custom ${typeLabel} Tasks`, type, isOverride: true },
  });
  if (!checklist) {
    checklist = await db.onboardingChecklist.create({
      // Standalone per-person tasks need a checklist relation for workflow
      // labeling, but must not be resolved as a template for future hires.
      data: { name: `Custom ${typeLabel} Tasks`, type, isOverride: true },
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
      assigneeId: assigneeId || null,
      assigneeDepartmentId: assigneeId ? null : assigneeDepartmentId || null,
      order: (maxOrder?.order ?? -1) + 1,
    },
  });

  const task = await db.employeeTask.create({
    data: {
      employeeId,
      checklistItemId: checklistItem.id,
      status: "PENDING",
      title,
      description: description || null,
      assigneeId: assigneeId || null,
      assigneeDepartmentId: assigneeId ? null : assigneeDepartmentId || null,
    },
  });

  const employee = await db.employee.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true } });
  if (employee) {
    const { notifyTaskAssignment } = await import("@/lib/task-notifications");
    await notifyTaskAssignment({
      taskId: task.id,
      assigneeId,
      assigneeDepartmentId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      taskTitle: title,
      taskDescription: description,
      workflow: type,
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/training");
  revalidatePath("/my-tasks");
  revalidatePath("/offboarding");
  revalidatePath("/pre-onboarding");
  revalidatePath("/settings");
  return task;
}

export async function completePreOnboarding(employeeId: string, companyEmail?: string) {
  const { advanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
  const result = await advanceWrittenOfferToOnboarding(employeeId, companyEmail);
  return result.employee;
}

export async function setEmployeeTrainingRequired(employeeId: string, required: boolean) {
  const { requireAdmin } = await import("@/lib/auth-helpers");
  await requireAdmin();
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "PRE_ONBOARDING") {
    throw new Error("Training can only be selected while the person is in Written Offer.");
  }
  if (required && !(await isJobTitleEligibleForTraining(employee.jobTitle))) {
    throw new Error("This job title is not selected for Training in Settings.");
  }

  await db.employee.update({ where: { id: employeeId }, data: { requiresTraining: required } });
  const { audit } = await import("@/lib/audit");
  await audit({
    action: "employee.training_requirement_updated",
    entityType: "employee",
    entityId: employeeId,
    details: { required },
  });

  const { maybeAdvanceWrittenOfferToOnboarding } = await import("@/lib/written-offer");
  await maybeAdvanceWrittenOfferToOnboarding(employeeId);
  revalidatePath("/pre-onboarding");
  revalidatePath("/training");
  return db.employee.findUnique({ where: { id: employeeId } });
}

export async function completeTraining(employeeId: string) {
  const { requireAdmin } = await import("@/lib/auth-helpers");
  await requireAdmin();
  const { advanceTrainingToOnboarding } = await import("@/lib/written-offer");
  const result = await advanceTrainingToOnboarding(employeeId);
  return result.employee;
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

  // Send ONBOARDING_COMPLETED notification
  const { sendNotifications } = await import("@/lib/notifications/send");
  sendNotifications({
    action: "ONBOARDING_COMPLETED",
    employeeId,
    message: `${employee.firstName} ${employee.lastName} completed onboarding`,
    link: "/onboarding",
    emailSubject: `Onboarding Completed: ${employee.firstName} ${employee.lastName}`,
    emailBody: `<p><strong>${employee.firstName} ${employee.lastName}</strong> has completed onboarding and is now active.</p>`,
  }).catch((err) => console.error("[employees] Onboarding complete notification error:", err));

  // Schedule the standard new-hire 1:1 cadence (30d / 90d / 1y).
  try {
    const { scheduleNewHireOneOnOnes } = await import("./one-on-ones");
    await scheduleNewHireOneOnOnes(employeeId);
  } catch (err) {
    console.error("[employees] Failed to schedule new-hire 1:1s:", err);
  }

  revalidatePath("/onboarding");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");
  return employee;
}

/**
 * Soft-delete an employee. Sets archivedAt + revokes their login. The record
 * stays in the DB and is visible only on the Archive page (SUPER_ADMIN).
 *
 * Kept the export name `deleteEmployee` so existing UI callers keep working.
 * For a true permanent delete, see `purgeEmployee`.
 */
export async function deleteEmployee(id: string, reason?: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to archive employees");
  }

  // Revoke the user's login so an archived person can't sign back in.
  await db.user.deleteMany({ where: { employeeId: id } });

  // Unlink manager/buddy/department-head references so directories stop
  // pointing at the archived person.
  await db.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
  await db.employee.updateMany({ where: { buddyId: id }, data: { buddyId: null } });
  await db.department.updateMany({ where: { headId: id }, data: { headId: null } });

  const target = await db.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true } });
  await db.employee.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archivedById: session.user?.employeeId ?? null,
      archivedReason: reason ?? null,
    },
  });
  const { audit } = await import("@/lib/audit");
  await audit({
    action: "employee.archived",
    entityType: "employee",
    entityId: id,
    details: {
      name: target ? `${target.firstName} ${target.lastName}` : null,
      email: target?.email ?? null,
      reason: reason ?? null,
    },
  });

  revalidatePath("/people");
  revalidatePath("/people/archive");
  revalidatePath("/org");
  revalidatePath("/org/departments");
  revalidatePath("/onboarding");
  revalidatePath("/offboarding");
}

/** Restore an archived employee. SUPER_ADMIN only. Does not re-create the User row. */
export async function restoreEmployee(id: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can restore employees");
  }

  await db.employee.update({
    where: { id },
    data: { archivedAt: null, archivedById: null, archivedReason: null },
  });
  const { audit } = await import("@/lib/audit");
  await audit({ action: "employee.restored", entityType: "employee", entityId: id });

  revalidatePath("/people");
  revalidatePath("/people/archive");
  revalidatePath("/org");
}

/** Permanently delete an archived employee + cascade their data. SUPER_ADMIN only. */
export async function purgeEmployee(id: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can permanently delete employees");
  }

  await db.user.deleteMany({ where: { employeeId: id } });

  try {
    await db.reaction.deleteMany({ where: { employeeId: id } });
    await db.savedMessage.deleteMany({ where: { employeeId: id } });
    await db.pinnedMessage.deleteMany({ where: { pinnedById: id } });
    await db.message.deleteMany({ where: { authorId: id } });
    await db.channelMember.deleteMany({ where: { employeeId: id } });
    await db.dmMember.deleteMany({ where: { employeeId: id } });
    await db.chatMember.deleteMany({ where: { employeeId: id } });
  } catch {
    // Chat tables may not exist yet
  }

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

  const purgedTarget = await db.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true } });
  await db.employee.delete({ where: { id } });
  const { audit } = await import("@/lib/audit");
  await audit({
    action: "employee.purged",
    entityType: "employee",
    entityId: id,
    details: purgedTarget ? { name: `${purgedTarget.firstName} ${purgedTarget.lastName}`, email: purgedTarget.email } : undefined,
  });

  revalidatePath("/people");
  revalidatePath("/people/archive");
  revalidatePath("/org");
}

/** List archived employees (SUPER_ADMIN only). */
export async function getArchivedEmployees() {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can view the archive");
  }
  return db.employee.findMany({
    where: { archivedAt: { not: null } },
    include: { department: true },
    orderBy: { archivedAt: "desc" },
  });
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

/**
 * Permanently delete PENDING employees (bulk-import mistakes, etc.).
 * Only PENDING rows are removed — never ACTIVE / ONBOARDING / OFFBOARDED.
 */
export async function deletePendingEmployees(employeeIds: string[]) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized to delete pending employees");
  }

  const ids = Array.from(new Set(employeeIds.filter(Boolean)));
  if (ids.length === 0) return { deleted: 0, errors: [] as string[] };

  const pending = await db.employee.findMany({
    where: { id: { in: ids }, status: "PENDING" },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const errors: string[] = [];
  if (pending.length < ids.length) {
    errors.push("Some selected employees were skipped because they are no longer pending.");
  }

  let deleted = 0;
  const { audit } = await import("@/lib/audit");

  for (const emp of pending) {
    try {
      await db.user.deleteMany({ where: { employeeId: emp.id } });
      await db.employeeTask.deleteMany({ where: { employeeId: emp.id } });
      await db.employee.delete({ where: { id: emp.id } });
      await audit({
        action: "employee.pending_deleted",
        entityType: "employee",
        entityId: emp.id,
        details: { name: `${emp.firstName} ${emp.lastName}`, email: emp.email },
      });
      deleted++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${emp.firstName} ${emp.lastName}: ${message}`);
    }
  }

  revalidatePath("/people");
  revalidatePath("/org");
  return { deleted, errors };
}
