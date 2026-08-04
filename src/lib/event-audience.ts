// Audience visibility for feed posts / events. "all" posts are visible to
// everyone; "departments"/"employees" posts only to members of the listed
// departments / the listed employees. Admin-tier roles and the author always
// see their posts.

export type AudienceFields = {
  audienceType: string;
  audienceDeptIds: string | null;
  audienceEmployeeIds: string | null;
  authorId?: string | null;
};

export type AudienceViewer = {
  employeeId?: string | null;
  departmentId?: string | null;
  role?: string | null;
};

export function isAdminAudienceRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

export function canSeeAudiencePost(
  post: AudienceFields,
  viewer: AudienceViewer
): boolean {
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
