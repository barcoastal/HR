export const DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES = ["Opener"] as const;

export function parseTrainingEligibleJobTitles(value: string | null | undefined): string[] {
  if (!value) return [...DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [...DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES];
    return [...new Set(parsed.filter((title): title is string => typeof title === "string").map((title) => title.trim()).filter(Boolean))];
  } catch {
    return [...DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES];
  }
}

/** Compare job-title names without making casing or surrounding spaces significant. */
export function isTrainingEligibleJobTitle(
  jobTitle: string | null | undefined,
  eligibleJobTitles: readonly string[] = DEFAULT_TRAINING_ELIGIBLE_JOB_TITLES,
): boolean {
  const normalized = jobTitle?.trim().toLowerCase();
  return Boolean(normalized && eligibleJobTitles.some((title) => title.trim().toLowerCase() === normalized));
}
