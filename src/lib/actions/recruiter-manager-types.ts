export type RecruiterSummary = {
  id: string;
  name: string;
  jobTitle: string | null;
  status: string;
  hasLoginAccount: boolean;
  loginEmail: string | null;
  totals: {
    assigned: number;
    activePipeline: number;
    hired: number;
    rejected: number;
    interviewsThisWeek: number;
    appsThisWeek: number;
    hiredThisMonth: number;
  };
  lastActivityAt: Date | null;
};

export type CandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  positionTitle: string | null;
  recruiterId: string | null;
  createdAt: Date;
  inPipeline: boolean;
};

export type RecruiterManagerData = {
  recruiters: RecruiterSummary[];
  unassignedCount: number;
  totalCandidates: number;
};
