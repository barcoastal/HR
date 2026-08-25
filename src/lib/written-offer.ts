import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  sendFillRequestEmail,
  sendOnboardingEmail,
  sendSigningRequestEmail,
  sendWelcomeEmail,
} from "@/lib/email";
import type { ResolvedTask } from "@/lib/actions/onboarding-resolution";
import type { Employee, EmployeeTask } from "@/generated/prisma/client";
import { isJobTitleEligibleForTraining } from "@/lib/training-eligibility-server";

type WrittenOfferEmployee = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

/** Create and deliver checklist-backed documents assigned to Written Offer. */
export async function assignWrittenOfferTasks(employee: WrittenOfferEmployee, tasks: ResolvedTask[]) {
  const { createSigningRequest } = await import("@/lib/actions/signing");
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const createdTasks = [];

  for (const task of tasks) {
    const employeeTask = await db.employeeTask.create({
      data: {
        employeeId: employee.id,
        checklistItemId: task.checklistItemId,
        title: task.title,
        description: task.description,
        status: task.documentAction === "SEND" ? "DONE" : "PENDING",
        completedAt: task.documentAction === "SEND" ? new Date() : null,
        documentAction: task.documentAction,
        documentUrl: task.documentUrl,
        documentName: task.documentName,
        documentRecipient: task.documentRecipient || "EMPLOYEE",
        externalEmail: task.externalEmail || null,
        externalName: task.externalName || null,
        assigneeId: task.assigneeId,
        assigneeDepartmentId: task.assigneeDepartmentId,
      },
    });
    createdTasks.push(employeeTask);

    try {
      if (task.documentAction === "SEND" && task.sendEmail && task.emailSubject && task.emailBody) {
        await sendOnboardingEmail({
          to: employee.email,
          subject: task.emailSubject,
          body: task.emailBody,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
        });
      } else if ((task.documentAction === "SIGN" || task.documentAction === "FILL") && task.documentUrl && task.documentName) {
        let recipientEmail = employee.email;
        let recipientFirstName = employee.firstName;
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
          recipientEmail = task.externalEmail;
          recipientFirstName = task.externalName || "there";
        }

        const request = await createSigningRequest(
          employeeTask.id,
          recipientEmployeeId,
          task.documentUrl,
          task.documentName
        );
        if (task.documentAction === "SIGN") {
          await sendSigningRequestEmail({
            to: recipientEmail,
            firstName: recipientFirstName,
            documentName: task.documentName,
            signingUrl: `${baseUrl}/sign/${request.token}`,
          });
        } else {
          await sendFillRequestEmail({
            to: recipientEmail,
            firstName: recipientFirstName,
            documentName: task.documentName,
            fillUrl: `${baseUrl}/fill/${request.token}`,
          });
        }
      } else if (task.sendEmail && task.emailSubject && task.emailBody) {
        await sendOnboardingEmail({
          to: employee.email,
          subject: task.emailSubject,
          body: task.emailBody,
        });
      }
    } catch (error) {
      console.error(`[written-offer] Failed to deliver task ${employeeTask.id}:`, error);
    }

    const { notifyTaskAssignment } = await import("@/lib/task-notifications");
    await notifyTaskAssignment({
      taskId: employeeTask.id,
      assigneeId: task.assigneeId,
      assigneeDepartmentId: task.assigneeDepartmentId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      taskTitle: task.title,
      taskDescription: task.description,
      workflow: "PRE_ONBOARDING",
    });
  }

  revalidatePath("/pre-onboarding");
  return createdTasks;
}

/**
 * Move a Written Offer employee into Onboarding once every document that
 * requires their input is fully completed. Older standalone stage-document
 * requests are included so employees already in flight are not stranded.
 */
export async function maybeAdvanceWrittenOfferToOnboarding(employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, createdAt: true },
  });
  if (!employee || employee.status !== "PRE_ONBOARDING") return false;

  const [requiredDocumentTasks, standaloneRequests] = await Promise.all([
    db.employeeTask.findMany({
      where: {
        employeeId,
        documentAction: { in: ["SIGN", "FILL"] },
      },
      select: { status: true },
    }),
    db.signingRequest.findMany({
      where: {
        employeeId,
        employeeTaskId: null,
        createdAt: { gte: employee.createdAt },
        status: { not: "VOIDED" },
      },
      select: { status: true },
    }),
  ]);

  const allTasksDone = requiredDocumentTasks.every((task) => task.status === "DONE");
  const allStandaloneRequestsDone = standaloneRequests.every((request) => request.status === "SIGNED");
  if (!allTasksDone || !allStandaloneRequestsDone) return false;

  const result = await advanceWrittenOfferToOnboarding(employeeId);
  return result.transitioned;
}

type TransitionSource = "PRE_ONBOARDING" | "TRAINING";
type InternalWorkflow = "TRAINING" | "ONBOARDING";

async function claimWorkflowTransition(
  employee: Employee,
  sourceStatus: TransitionSource,
  targetStatus: InternalWorkflow,
  resolvedTasks: ResolvedTask[],
  companyEmail?: string
): Promise<EmployeeTask[] | null> {
  return db.$transaction(async (tx) => {
    const trimmedEmail = companyEmail?.trim();
    const claimed = await tx.employee.updateMany({
      where: { id: employee.id, status: sourceStatus },
      data: {
        status: targetStatus,
        ...(trimmedEmail && trimmedEmail !== employee.email ? { email: trimmedEmail } : {}),
      },
    });
    if (claimed.count === 0) return null;

    const checklistItemIds = resolvedTasks.map((task) => task.checklistItemId);
    const existingTasks = checklistItemIds.length > 0
      ? await tx.employeeTask.findMany({
          where: { employeeId: employee.id, checklistItemId: { in: checklistItemIds } },
          select: { checklistItemId: true },
        })
      : [];
    const existingItemIds = new Set(existingTasks.map((task) => task.checklistItemId));
    const created: EmployeeTask[] = [];

    for (const task of resolvedTasks) {
      if (existingItemIds.has(task.checklistItemId)) continue;
      created.push(await tx.employeeTask.create({
        data: {
          employeeId: employee.id,
          checklistItemId: task.checklistItemId,
          title: task.title,
          description: task.description,
          documentAction: task.documentAction,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
          documentRecipient: task.documentRecipient || "EMPLOYEE",
          externalEmail: task.externalEmail || null,
          externalName: task.externalName || null,
          assigneeId: task.assigneeId,
          assigneeDepartmentId: task.assigneeDepartmentId,
        },
      }));
    }
    return created;
  });
}

async function ensureEmployeeLogin(employee: Employee, finalEmail: string, companyEmail?: string) {
  const existingUser = await db.user.findFirst({ where: { employeeId: employee.id } });
  if (existingUser || !companyEmail?.trim()) return;

  const userByEmail = await db.user.findUnique({ where: { email: finalEmail } });
  if (!userByEmail) {
    await db.user.create({ data: { email: finalEmail, role: "EMPLOYEE", employeeId: employee.id } });
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      await sendWelcomeEmail({ to: finalEmail, role: "Employee", loginUrl: `${baseUrl}/login` });
    } catch (error) {
      console.error("[written-offer] Failed to send welcome email:", error);
    }
  } else if (!userByEmail.employeeId) {
    await db.user.update({ where: { id: userByEmail.id }, data: { employeeId: employee.id } });
  }
}

async function deliverWorkflowTasks(
  employee: Employee,
  tasks: EmployeeTask[],
  finalEmail: string,
  workflow: InternalWorkflow
) {
  const { createSigningRequest } = await import("@/lib/actions/signing");
  const { notifyTaskAssignment } = await import("@/lib/task-notifications");
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const workflowLabel = workflow === "TRAINING" ? "Training" : "Onboarding";

  for (const task of tasks) {
    try {
      if (task.documentAction === "SEND" && task.documentUrl) {
        await sendOnboardingEmail({
          to: finalEmail,
          subject: task.title || `${workflowLabel} document`,
          body: task.description || `Please review the attached ${workflowLabel.toLowerCase()} document.`,
          documentUrl: task.documentUrl,
          documentName: task.documentName,
        });
      } else if ((task.documentAction === "SIGN" || task.documentAction === "FILL") && task.documentUrl && task.documentName) {
        let recipientEmail = finalEmail;
        let recipientFirstName = employee.firstName;
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
          recipientEmail = task.externalEmail;
          recipientFirstName = task.externalName || "there";
        }

        const request = await createSigningRequest(task.id, recipientEmployeeId, task.documentUrl, task.documentName);
        if (task.documentAction === "SIGN") {
          await sendSigningRequestEmail({
            to: recipientEmail,
            firstName: recipientFirstName,
            documentName: task.documentName,
            signingUrl: `${baseUrl}/sign/${request.token}`,
          });
        } else {
          await sendFillRequestEmail({
            to: recipientEmail,
            firstName: recipientFirstName,
            documentName: task.documentName,
            fillUrl: `${baseUrl}/fill/${request.token}`,
          });
        }
      }
    } catch (error) {
      console.error(`[written-offer] Failed to prepare ${workflowLabel.toLowerCase()} task ${task.id}:`, error);
    }

    await notifyTaskAssignment({
      taskId: task.id,
      assigneeId: task.assigneeId,
      assigneeDepartmentId: task.assigneeDepartmentId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      taskTitle: task.title || `${workflowLabel} task`,
      taskDescription: task.description,
      workflow,
    });
  }
}

async function transitionWrittenOfferToTraining(employee: Employee, companyEmail?: string) {
  const { resolveTrainingTasks } = await import("@/lib/actions/onboarding-resolution");
  const trainingTasks = await resolveTrainingTasks(employee.departmentId, employee.jobTitle);
  const finalEmail = companyEmail?.trim() || employee.email;
  const createdTasks = await claimWorkflowTransition(
    employee,
    "PRE_ONBOARDING",
    "TRAINING",
    trainingTasks,
    companyEmail
  );
  if (!createdTasks) {
    const current = await db.employee.findUnique({ where: { id: employee.id } });
    return { transitioned: false, employee: current || employee };
  }

  await ensureEmployeeLogin(employee, finalEmail, companyEmail);
  await deliverWorkflowTasks(employee, createdTasks, finalEmail, "TRAINING");

  revalidatePath("/pre-onboarding");
  revalidatePath("/training");
  revalidatePath("/people");
  revalidatePath(`/people/${employee.id}`);
  revalidatePath("/org");

  const updatedEmployee = await db.employee.findUnique({ where: { id: employee.id } });
  return { transitioned: true, employee: updatedEmployee || employee };
}

async function transitionToOnboarding(
  employee: Employee,
  sourceStatus: TransitionSource,
  companyEmail?: string
) {
  const finalEmail = companyEmail?.trim() || employee.email;
  const { resolveOnboardingTasks, resolvePreOnboardingTasks } = await import("@/lib/actions/onboarding-resolution");
  const [onboardingTasks, writtenOfferConfiguration] = await Promise.all([
    resolveOnboardingTasks(employee.departmentId, employee.jobTitle),
    resolvePreOnboardingTasks(employee.departmentId, employee.jobTitle),
  ]);
  const deferredInternalTasks = writtenOfferConfiguration.filter(
    (task) => !["SEND", "SIGN", "FILL"].includes(task.documentAction)
  );
  const resolvedTasks = [...deferredInternalTasks, ...onboardingTasks];
  const createdTasks = await claimWorkflowTransition(
    employee,
    sourceStatus,
    "ONBOARDING",
    resolvedTasks,
    companyEmail
  );
  if (!createdTasks) {
    const current = await db.employee.findUnique({ where: { id: employee.id } });
    return { transitioned: false, employee: current || employee };
  }

  await ensureEmployeeLogin(employee, finalEmail, companyEmail);
  await deliverWorkflowTasks(employee, createdTasks, finalEmail, "ONBOARDING");

  const { seedNotificationRules } = await import("@/lib/notifications/seed");
  const { sendNotifications } = await import("@/lib/notifications/send");
  const previousStep = sourceStatus === "TRAINING" ? "Training" : "Written Offer";
  await seedNotificationRules(["ONBOARDING_STARTED"]);
  await sendNotifications({
    action: "ONBOARDING_STARTED",
    employeeId: employee.id,
    message: `${employee.firstName} ${employee.lastName} completed ${previousStep} and moved to Onboarding`,
    link: "/onboarding",
  });

  revalidatePath("/pre-onboarding");
  revalidatePath("/training");
  revalidatePath("/onboarding");
  revalidatePath("/people");
  revalidatePath(`/people/${employee.id}`);
  revalidatePath("/org");

  const updatedEmployee = await db.employee.findUnique({ where: { id: employee.id } });
  return { transitioned: true, employee: updatedEmployee || employee };
}

/** Advance completed Written Offer work to the selected next lifecycle step. */
export async function advanceWrittenOfferToOnboarding(employeeId: string, companyEmail?: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "PRE_ONBOARDING") return { transitioned: false, employee };
  if (employee.requiresTraining && await isJobTitleEligibleForTraining(employee.jobTitle)) {
    return transitionWrittenOfferToTraining(employee, companyEmail);
  }
  if (employee.requiresTraining) {
    await db.employee.update({ where: { id: employee.id }, data: { requiresTraining: false } });
  }
  return transitionToOnboarding(employee, "PRE_ONBOARDING", companyEmail);
}

/** Move a selected person from Training into Onboarding after all training tasks are complete. */
export async function advanceTrainingToOnboarding(employeeId: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "TRAINING") return { transitioned: false, employee };

  const pendingTrainingTasks = await db.employeeTask.count({
    where: {
      employeeId,
      status: "PENDING",
      checklistItem: { checklist: { type: "TRAINING" } },
    },
  });
  if (pendingTrainingTasks > 0) throw new Error("Complete every training task before moving to Onboarding.");
  return transitionToOnboarding(employee, "TRAINING");
}
