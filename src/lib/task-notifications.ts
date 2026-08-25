import { db } from "@/lib/db";
import { sendTaskAssignmentEmail } from "@/lib/email";

export async function notifyTaskAssignment(input: {
  taskId: string;
  assigneeId?: string | null;
  assigneeDepartmentId?: string | null;
  employeeName: string;
  taskTitle: string;
  taskDescription?: string | null;
  workflow: "PRE_ONBOARDING" | "TRAINING" | "ONBOARDING" | "OFFBOARDING";
}) {
  const recipients = input.assigneeId
    ? await db.employee.findMany({
        where: { id: input.assigneeId, archivedAt: null },
        select: { id: true, email: true, firstName: true },
      })
    : input.assigneeDepartmentId
      ? await db.employee.findMany({
          where: {
            departmentId: input.assigneeDepartmentId,
            archivedAt: null,
            status: { not: "OFFBOARDED" },
          },
          select: { id: true, email: true, firstName: true },
        })
      : [];
  if (recipients.length === 0) return;

  const path = "/my-tasks";
  await db.notification.createMany({
    data: recipients.map((recipient) => ({
      recipientId: recipient.id,
      type: "TASK_ASSIGNED",
      message: `${input.taskTitle} assigned for ${input.employeeName}`,
      link: path,
    })),
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await Promise.all(recipients.map((recipient) => sendTaskAssignmentEmail({
    to: recipient.email,
    assigneeName: recipient.firstName,
    newHireName: input.employeeName,
    taskTitle: input.taskTitle,
    taskDescription: input.taskDescription,
    taskId: input.taskId,
    taskUrl: `${baseUrl}${path}`,
    workflowName: input.workflow === "PRE_ONBOARDING"
      ? "Written Offer"
      : input.workflow === "TRAINING"
        ? "Training"
        : input.workflow === "ONBOARDING"
          ? "Onboarding"
          : "Offboarding",
  })));
}
