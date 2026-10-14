import type { ClassColor, ClassStatus, ColorCounts } from "./logic";

export type ClassSummary = {
  id: string;
  name: string;
  role: string;
  positionId: string | null;
  positionTitle: string | null;
  /** YYYY-MM-DD */
  startDate: string;
  targetCount: number | null;
  notes: string | null;
  status: ClassStatus;
  counts: ColorCounts;
};

export type ClassMemberRow = {
  id: string;
  candidateId: string;
  name: string;
  email: string;
  phone: string | null;
  stage: string;
  recruiter: string | null;
  doNotCall: boolean;
  color: ClassColor;
  note: string | null;
  canEdit: boolean;
};

export type ClassDetail = ClassSummary & {
  members: ClassMemberRow[];
  /** Total members in the class, including ones hidden from a scoped recruiter. */
  totalMembers: number;
  /** True when the viewer is a recruiter who only sees their own candidates. */
  scoped: boolean;
};

export type ClassPermissions = {
  /** Create, edit and delete classes; manage every member. */
  canManage: boolean;
  /** Add candidates and set colour/note (managers of classes, or recruiters for their own candidates). */
  canEditMembers: boolean;
};

export type CandidatePickerOption = {
  id: string;
  name: string;
  email: string;
  stage: string;
  positionTitle: string | null;
};

export type CandidateClassMembership = {
  memberId: string;
  classId: string;
  className: string;
  role: string;
  startDate: string;
  status: ClassStatus;
  color: ClassColor;
};

export type CandidateClassesPayload = {
  memberships: CandidateClassMembership[];
  /** Upcoming classes this candidate can still be added to (empty when the viewer cannot add). */
  options: { id: string; name: string; startDate: string }[];
  canAdd: boolean;
  canEdit: boolean;
};
