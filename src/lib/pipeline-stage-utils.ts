// The original 8 pipeline stages keep these ids in the settings JSON
// (CompanySettings.pipelineStages). Candidates without a stageId are matched
// by this id FIRST, so they stay in their original column even when settings
// remap a stage's base status (e.g. "Contacted" mapped to SCREENING must not
// swallow Screening candidates).
export const LEGACY_STAGE_ID_BY_STATUS: Record<string, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  SCREENING: "screening",
  INTERVIEW: "interview",
  OFFER: "offer",
  BACKGROUND_CHECK: "bg_check",
  HIRED: "hired",
  REJECTED: "rejected",
};
