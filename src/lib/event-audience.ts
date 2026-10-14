// Audience visibility for feed posts / events. "all" posts are visible to
// everyone; "departments"/"employees" posts only to members of the listed
// departments / the listed employees. Admin-tier roles and the author always
// see their posts.

export type AudienceFields = {
  audienceType: string;
  audienceDeptIds: string | null;
  audienceEmployeeIds: string | null;
  authorId?: string | null;
  /** Calendar partition; missing or "everyone" means audience rules only. */
  eventVisibility?: string | null;
};

export type AudienceViewer = {
  employeeId?: string | null;
  departmentId?: string | null;
  role?: string | null;
};

export function isAdminAudienceRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

export const EVENT_VISIBILITIES = ["everyone", "managers", "admins", "invited"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_VISIBILITY_LABEL: Record<EventVisibility, string> = {
  everyone: "Everyone",
  managers: "Managers & admins only",
  admins: "Admins / HR only",
  invited: "Only invited people",
};

export function normalizeEventVisibility(value?: string | null): EventVisibility {
  return (EVENT_VISIBILITIES as readonly string[]).includes(value || "") ? (value as EventVisibility) : "everyone";
}

/** Roles that may see an event at each partition, in addition to its invitees and author. */
export function visibilityAllowsRole(visibility: EventVisibility, role?: string | null): boolean {
  if (visibility === "everyone") return true;
  if (visibility === "managers") return isAdminAudienceRole(role) || role === "MANAGER";
  if (visibility === "admins") return isAdminAudienceRole(role);
  return false;
}

/** The viewer is the author or on the post's explicit department/person audience. */
export function isExplicitAudienceMember(post: AudienceFields, viewer: AudienceViewer): boolean {
  if (post.authorId && viewer.employeeId && post.authorId === viewer.employeeId) return true;
  try {
    if (post.audienceType === "departments") {
      const ids: string[] = JSON.parse(post.audienceDeptIds || "[]");
      return !!viewer.departmentId && ids.includes(viewer.departmentId);
    }
    if (post.audienceType === "employees") {
      const ids: string[] = JSON.parse(post.audienceEmployeeIds || "[]");
      return !!viewer.employeeId && ids.includes(viewer.employeeId);
    }
  } catch {
    // Malformed audience JSON — fail closed.
  }
  return false;
}

export function canSeeAudiencePost(
  post: AudienceFields,
  viewer: AudienceViewer
): boolean {
  const visibility = normalizeEventVisibility(post.eventVisibility);
  if (visibility !== "everyone") {
    // Partitioned events: invitees and the author, plus the roles the
    // partition admits. An "all" audience never admits anyone on its own here,
    // so a restricted event cannot leak through a company-wide audience.
    return isExplicitAudienceMember(post, viewer) || visibilityAllowsRole(visibility, viewer.role);
  }
  if (!post.audienceType || post.audienceType === "all") return true;
  if (isAdminAudienceRole(viewer.role)) return true;
  if (post.authorId && viewer.employeeId && post.authorId === viewer.employeeId) {
    return true;
  }
  try {
    if (post.audienceType === "departments") {
      const ids: string[] = JSON.parse(post.audienceDeptIds || "[]");
      return !!viewer.departmentId && ids.includes(viewer.departmentId);
    }
    if (post.audienceType === "employees") {
      const ids: string[] = JSON.parse(post.audienceEmployeeIds || "[]");
      return !!viewer.employeeId && ids.includes(viewer.employeeId);
    }
  } catch {
    // Malformed audience JSON — fail closed for targeted posts.
  }
  return false;
}
