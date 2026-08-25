import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  sendFillRequestEmail,
  sendOnboardingEmail,
  sendSigningRequestEmail,
  sendTaskAssignmentEmail,
  sendWelcomeEmail,
} from "@/lib/email";
import type { ResolvedTask } from "@/lib/actions/onboarding-resolution";

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
  const documentTasks = tasks.filter((task) => ["SEND", "SIGN", "FILL"].includes(task.documentAction));
  const createdTasks = [];

  for (const task of documentTasks) {
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

/**
 * Performs the status transition and creates the internal Onboarding work.
 * The status update is an atomic claim, making repeated completion callbacks
 * safe even when two documents are submitted at nearly the same time.
 */
export async function advanceWrittenOfferToOnboarding(employeeId: string, companyEmail?: string) {
  const employee = await db.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  if (employee.status !== "PRE_ONBOARDING") {
    return { transitioned: false, employee };
  }

  const finalEmail = companyEmail?.trim() || employee.email;
  const { resolveOnboardingTasks, resolvePreOnboardingTasks } = await import("@/lib/actions/onboarding-resolution");
  const [onboardingTasks, writtenOfferConfiguration] = await Promise.all([
    resolveOnboardingTasks(employee.departmentId, employee.jobTitle),
    resolvePreOnboardingTasks(employee.departmentId, employee.jobTitle),
  ]);
  // Legacy non-document items configured under the old Pre-Onboarding section
  // are preserved, but assigned only now that the employee is in Onboarding.
  const deferredInternalTasks = writtenOfferConfiguration.filter(
    (task) => !["SEND", "SIGN", "FILL"].includes(task.documentAction)
  );
  const resolvedTasks = [...deferredInternalTasks, ...onboardingTasks];

  const createdTasks = await db.$transaction(async (tx) => {
    const updateData: { status: "ONBOARDING"; email?: string } = { status: "ONBOARDING" };
    if (companyEmail?.trim() && companyEmail.trim() !== employee.email) {
      updateData.email = companyEmail.trim();
    }

    const claimed = await tx.employee.updateMany({
      where: { id: employeeId, status: "PRE_ONBOARDING" },
      data: updateData,
    });
    if (claimed.count === 0) return null;

    const checklistItemIds = resolvedTasks.map((task) => task.checklistItemId);
    const existingTasks = checklistItemIds.length > 0
      ? await tx.employeeTask.findMany({
          where: { employeeId, checklistItemId: { in: checklistItemIds } },
          select: { checklistItemId: true },
        })
      : [];
    const existingItemIds = new Set(existingTasks.map((task) => task.checklistItemId));
    const created = [];

    for (const task of resolvedTasks) {
      if (existingItemIds.has(task.checklistItemId)) continue;
      created.push(await tx.employeeTask.create({
        data: {
          employeeId,
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
        },
      }));
    }

    return created;
  });

  if (!createdTasks) {
    const current = await db.employee.findUnique({ where: { id: employeeId } });
    return { transitioned: false, employee: current || employee };
  }

  // If HR supplied a company email during a manual transition, attach or create
  // the login now. Automatic document completion must not create a login on a
  // candidate's personal address merely to move internal work forward.
  const existingUser = await db.user.findFirst({ where: { employeeId } });
  if (!existingUser && companyEmail?.trim()) {
    const userByEmail = await db.user.findUnique({ where: { email: finalEmail } });
    if (!userByEmail) {
      await db.user.create({
        data: { email: finalEmail, role: "EMPLOYEE", employeeId: employee.id },
      });
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

  const { createSigningRequest } = await import("@/lib/actions/signing");
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const task of createdTasks) {
    try {
      if (task.documentAction === "SEND" && task.documentUrl) {
        await sendOnboardingEmail({
          to: finalEmail,
          subject: task.title || "Onboarding document",
          body: task.description || "Please review the attached onboarding document.",
          documentUrl: task.documentUrl,
          documentName: task.documentName,
        });
      } else if ((task.documentAction === "SIGN" || task.documentAction === "FILL") && task.documentUrl && task.documentName) {
        let recipientEmail = finalEmail;
        let recipientFirstName = employee.firstName;
        let recipientEmployeeId = employeeId;

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
          task.id,
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
      }
    } catch (error) {
      console.error(`[written-offer] Failed to prepare onboarding document task ${task.id}:`, error);
    }

    if (task.assigneeId) {
      const assignee = await db.employee.findUnique({ where: { id: task.assigneeId } });
      if (assignee) {
        try {
          await sendTaskAssignmentEmail({
            to: assignee.email,
            assigneeName: assignee.firstName,
            newHireName: `${employee.firstName} ${employee.lastName}`,
            taskTitle: task.title || "Onboarding task",
            taskDescription: task.description,
          });
        } catch (error) {
          console.error(`[written-offer] Failed to notify task assignee ${assignee.id}:`, error);
        }
      }
    }
  }

  // Make the transition visible to the manager and configured HR team.
  const { seedNotificationRules } = await import("@/lib/notifications/seed");
  const { sendNotifications } = await import("@/lib/notifications/send");
  await seedNotificationRules(["ONBOARDING_STARTED"]);
  await sendNotifications({
    action: "ONBOARDING_STARTED",
    employeeId,
    message: `${employee.firstName} ${employee.lastName} completed Written Offer and moved to Onboarding`,
    link: "/onboarding",
  });

  revalidatePath("/pre-onboarding");
  revalidatePath("/onboarding");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/org");

  const updatedEmployee = await db.employee.findUnique({ where: { id: employeeId } });
  return { transitioned: true, employee: updatedEmployee || employee };
}
