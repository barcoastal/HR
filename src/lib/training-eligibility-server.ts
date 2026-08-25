import "server-only";

import { db } from "@/lib/db";
import {
  DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES,
  isTrainingEligibleJobTitle,
  parseTrainingEligibleJobTitles,
} from "@/lib/training-eligibility";

export async function getTrainingEligibleJobTitles(): Promise<string[]> {
  try {
    const settings = await db.companySettings.findUnique({
      where: { id: "singleton" },
      select: { trainingEligibleJobTitles: true },
    });
    return settings
      ? parseTrainingEligibleJobTitles(settings.trainingEligibleJobTitles)
      : [...DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES];
  } catch {
    return [...DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES];
  }
}

export async function isJobTitleEligibleForTraining(jobTitle: string | null | undefined): Promise<boolean> {
  const eligibleJobTitles = await getTrainingEligibleJobTitles();
  return isTrainingEligibleJobTitle(jobTitle, eligibleJobTitles);
}
