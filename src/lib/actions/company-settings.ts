"use server";

import { db } from "@/lib/db";
import { cache } from "react";
import { revalidatePath } from "next/cache";

const SINGLETON_ID = "singleton";

const DEFAULTS = {
  id: SINGLETON_ID,
  companyName: "Coastal HR",
  domain: "",
  industry: "",
  companySize: "",
  logoUrl: null as string | null,
  faviconUrl: null as string | null,
  senderEmail: "noreply@hr.coastaldebt-tools.com",
  senderName: "Coastal HR",
  recruiterIds: "[]",
  pipelineStages: "[]",
  candidateCustomFields: "[]",
  stageNotifyRecipients: '["candidate"]',
  stageNotifyEmployeeIds: '[]',
  updatedAt: new Date(),
};

// Deduplicate within a single request (React.cache)
export const getCompanySettings = cache(async () => {
  try {
    const settings = await db.companySettings.findUnique({ where: { id: SINGLETON_ID } });
    if (settings) return settings;
    // Only create on first boot
    return await db.companySettings.create({ data: { id: SINGLETON_ID } });
  } catch {
    // DB unreachable during build — return defaults
    return DEFAULTS;
  }
});

export async function getRecruiters() {
  const settings = await getCompanySettings();
  const ids: string[] = JSON.parse(settings.recruiterIds || "[]");
  if (ids.length === 0) return [];
  return db.employee.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
  });
}

export async function updateRecruiters(recruiterIds: string[]) {
  await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: { recruiterIds: JSON.stringify(recruiterIds) },
    create: { id: SINGLETON_ID, recruiterIds: JSON.stringify(recruiterIds) },
  });
  revalidatePath("/settings");
  revalidatePath("/cv");
}

export async function updateCompanySettings(data: {
  companyName?: string;
  domain?: string;
  industry?: string;
  companySize?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  senderEmail?: string;
  senderName?: string;
  recruiterIds?: string;
}) {
  const settings = await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: data,
    create: { id: SINGLETON_ID, ...data },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return settings;
}

// ─── Pipeline Configuration ───

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  enumValue: string; // maps to CandidateStatus enum
  visible: boolean;
  order: number;
}

export interface CandidateCustomField {
  id: string;
  label: string;
  type: "text" | "select" | "number" | "date" | "url";
  options?: string[]; // for select type
  required: boolean;
  order: number;
}

// Pipeline stages = recruitment-only columns. Pre-Onboarding / Onboarding /
// Offboarding live in their own sections of the app, so we don't ship them
// here even though they remain valid CandidateStatus enum values.
const DEFAULT_STAGES: PipelineStage[] = [
  { id: "new", label: "New", color: "text-blue-400", bgColor: "bg-blue-500", enumValue: "NEW", visible: true, order: 0 },
  { id: "screening", label: "Screening", color: "text-amber-400", bgColor: "bg-amber-500", enumValue: "SCREENING", visible: true, order: 1 },
  { id: "interview", label: "Interview", color: "text-purple-400", bgColor: "bg-purple-500", enumValue: "INTERVIEW", visible: true, order: 2 },
  { id: "offer", label: "Offer", color: "text-emerald-400", bgColor: "bg-emerald-500", enumValue: "OFFER", visible: true, order: 3 },
  { id: "bg_check", label: "BG Check", color: "text-orange-400", bgColor: "bg-orange-500", enumValue: "BACKGROUND_CHECK", visible: true, order: 4 },
  { id: "hired", label: "Hired", color: "text-green-400", bgColor: "bg-green-500", enumValue: "HIRED", visible: true, order: 5 },
  { id: "rejected", label: "Rejected", color: "text-red-400", bgColor: "bg-red-500", enumValue: "REJECTED", visible: true, order: 6 },
];

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const settings = await getCompanySettings();
  try {
    const custom = JSON.parse(settings.pipelineStages || "[]");
    if (custom.length > 0) return custom;
  } catch {}
  return DEFAULT_STAGES;
}

export async function savePipelineStages(stages: PipelineStage[]) {
  await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: { pipelineStages: JSON.stringify(stages) },
    create: { id: SINGLETON_ID, pipelineStages: JSON.stringify(stages) },
  });
  revalidatePath("/cv");
  revalidatePath("/settings");
}

export async function getCandidateCustomFields(): Promise<CandidateCustomField[]> {
  const settings = await getCompanySettings();
  try {
    return JSON.parse(settings.candidateCustomFields || "[]");
  } catch {}
  return [];
}

export async function saveCandidateCustomFields(fields: CandidateCustomField[]) {
  await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: { candidateCustomFields: JSON.stringify(fields) },
    create: { id: SINGLETON_ID, candidateCustomFields: JSON.stringify(fields) },
  });
  revalidatePath("/cv");
  revalidatePath("/settings");
}

// ─── Stage Notification Recipients ───

export type StageNotifyRecipient = "candidate" | "recruiter" | "manager";

export async function getStageNotifyRecipients(): Promise<StageNotifyRecipient[]> {
  const settings = await getCompanySettings();
  try {
    return JSON.parse(settings.stageNotifyRecipients || '["candidate"]');
  } catch {}
  return ["candidate"];
}

export async function saveStageNotifyRecipients(recipients: StageNotifyRecipient[], employeeIds: string[]) {
  await db.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: {
      stageNotifyRecipients: JSON.stringify(recipients),
      stageNotifyEmployeeIds: JSON.stringify(employeeIds),
    },
    create: {
      id: SINGLETON_ID,
      stageNotifyRecipients: JSON.stringify(recipients),
      stageNotifyEmployeeIds: JSON.stringify(employeeIds),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/cv");
}

export async function getStageNotifyEmployeeIds(): Promise<string[]> {
  const settings = await getCompanySettings();
  try {
    return JSON.parse(settings.stageNotifyEmployeeIds || "[]");
  } catch {}
  return [];
}
