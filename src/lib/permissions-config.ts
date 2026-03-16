// Client-safe permissions configuration — no server/DB imports

export const ALL_PERMISSIONS = [
  { key: "settings", label: "Settings", description: "Access system settings, branding, email templates" },
  { key: "user_management", label: "User Management", description: "Invite users, change roles, delete users" },
  { key: "people", label: "People Directory", description: "View employee profiles and directory" },
  { key: "manage_employees", label: "Manage Employees", description: "Edit employee profiles, add/remove employees" },
  { key: "departments", label: "Manage Departments", description: "Create, edit, delete departments" },
  { key: "onboarding", label: "Onboarding", description: "Manage onboarding checklists and tasks" },
  { key: "offboarding", label: "Offboarding", description: "Manage offboarding checklists and tasks" },
  { key: "documents", label: "Documents & Signing", description: "Upload docs, send for signing, manage signed docs" },
  { key: "hr_notes", label: "HR Notes", description: "View and manage confidential HR notes on employees" },
  { key: "recruitment", label: "Recruitment", description: "Access recruitment pipeline, candidates, positions" },
  { key: "analytics", label: "Analytics", description: "View company analytics and reports" },
  { key: "time_off", label: "Time Off Management", description: "Manage PTO policies and balances" },
  { key: "approve_time_off", label: "Approve Time Off", description: "Approve or deny time off requests" },
  { key: "reviews", label: "Reviews", description: "Manage review cycles and view all reviews" },
  { key: "pulse", label: "Pulse Surveys", description: "Create and manage pulse surveys" },
  { key: "feed_post", label: "Post to Feed", description: "Create posts in the company feed" },
  { key: "voice", label: "Your Voice (Admin)", description: "View anonymous feedback submissions" },
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]["key"];

// Default permissions per role (used when no DB overrides exist)
export const DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS.map((p) => p.key),
  ADMIN: [
    "settings", "user_management", "people", "manage_employees", "departments",
    "onboarding", "offboarding", "documents", "hr_notes", "recruitment",
    "analytics", "time_off", "approve_time_off", "reviews", "pulse", "feed_post", "voice",
  ],
  HR: [
    "people", "manage_employees", "departments", "onboarding", "offboarding",
    "documents", "hr_notes", "recruitment", "analytics", "time_off",
    "approve_time_off", "reviews", "pulse", "feed_post", "voice",
  ],
  MANAGER: [
    "people", "manage_employees", "recruitment", "analytics",
    "approve_time_off", "reviews", "feed_post",
  ],
  EMPLOYEE: [
    "people", "feed_post",
  ],
};
