"use server";

import { db } from "@/lib/db";

type ResolvedTask = {
  checklistItemId: string;
  title: string;
  description: string | null;
  order: number;
  dueDay: number | null;
  assigneeId: string | null;
  documentAction: string;
  documentUrl: string | null;
  documentName: string | null;
  sendEmail: boolean;
  emailSubject: string | null;
  emailBody: string | null;
};

/**
 * Resolve the full onboarding task list for an employee.
 * Merges: global tasks + department tasks + job title overrides (extras - exclusions).
 */
export async function resolveOnboardingTasks(
  departmentId: string | null,
  jobTitle: string | null
): Promise<ResolvedTask[]> {
  // 1. Fetch global checklists
  const globalChecklists = await db.onboardingChecklist.findMany({
    where: { type: "ONBOARDING", departmentId: null, isOverride: false },
    include: { items: { orderBy: { order: "asc" } } },
  });

  // 2. Fetch department checklists
  const deptChecklists = departmentId
    ? await db.onboardingChecklist.findMany({
        where: { type: "ONBOARDING", departmentId, isOverride: false },
        include: { items: { orderBy: { order: "asc" } } },
      })
    : [];

  // 3. Collect base items
  const baseItems = [
    ...globalChecklists.flatMap((c) => c.items),
    ...deptChecklists.flatMap((c) => c.items),
  ];

  // 4. Resolve job title overrides
  let excludedIds = new Set<string>();
  let overrideItems: typeof baseItems = [];

  if (jobTitle && departmentId) {
    // Find matching JobTitle record (case-insensitive)
    const jobTitleRecord = await db.jobTitle.findFirst({
      where: { name: { equals: jobTitle, mode: "insensitive" } },
    });

    if (jobTitleRecord) {
      const overrideChecklist = await db.onboardingChecklist.findFirst({
        where: {
          type: "ONBOARDING",
          departmentId,
          jobTitleId: jobTitleRecord.id,
          isOverride: true,
        },
        include: {
          items: { orderBy: { order: "asc" } },
          exclusions: true,
        },
      });

      if (overrideChecklist) {
        excludedIds = new Set(overrideChecklist.exclusions.map((e) => e.excludedItemId));
        overrideItems = overrideChecklist.items;
      }
    }
  }

  // 5. Filter and merge
  const filteredBase = baseItems.filter((item) => !excludedIds.has(item.id));
  const allItems = [...filteredBase, ...overrideItems];

  // 6. Sort by dueDay then order
  allItems.sort((a, b) => {
    const dayA = a.dueDay ?? 0;
    const dayB = b.dueDay ?? 0;
    if (dayA !== dayB) return dayA - dayB;
    return a.order - b.order;
  });

  return allItems.map((item) => ({
    checklistItemId: item.id,
    title: item.title,
    description: item.description,
    order: item.order,
    dueDay: item.dueDay,
    assigneeId: item.assigneeId,
    documentAction: item.documentAction ?? "NONE",
    documentUrl: item.documentUrl,
    documentName: item.documentName,
    sendEmail: item.sendEmail,
    emailSubject: item.emailSubject,
    emailBody: item.emailBody,
  }));
}
