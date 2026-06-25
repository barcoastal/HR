import { cn, getInitials, formatDate } from "@/lib/utils";
import { getEmployeeById } from "@/lib/actions/employees";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { EditEmployeeDialog } from "@/components/people/edit-employee-dialog";
import { PromoteEmployeeDialog } from "@/components/people/promote-employee-dialog";
import { DeleteEmployeeButton } from "@/components/people/delete-employee-button";
import { ReactivateEmployeeButton } from "@/components/people/reactivate-employee-button";
import { HRNotesSection } from "@/components/people/hr-notes-section";
import { EmployeeDocumentsSection } from "@/components/people/employee-documents-section";
import { ResendStageDocsButton } from "@/components/onboarding/resend-stage-docs-button";
import { getHRNotes } from "@/lib/actions/hr-notes";
import { getEmployeeDocuments } from "@/lib/actions/employee-documents";
import { getNextOneOnOneForEmployee, getPastOneOnOnesForEmployee } from "@/lib/actions/one-on-ones";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { EmployeeGustoTab } from "@/components/gusto/employee-gusto-tab";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
        <Icon name={icon} size={16} className="text-[var(--color-accent)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
        <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const role = session.user?.role;
  const currentEmployeeId = session.user?.employeeId;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isManagerRole = role === "MANAGER";
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  // Employees may only see their own profile. Managers may also see their
  // direct reports. Admin/HR see everyone.
  const isOwnProfile = currentEmployeeId === employee.id;
  const isDirectReport = currentEmployeeId ? employee.managerId === currentEmployeeId : false;
  if (!isAdmin && !isOwnProfile && !(isManagerRole && isDirectReport)) {
    notFound();
  }

  const [hrNotes, documents, nextOneOnOne, pastOneOnOnes] = await Promise.all([
    getHRNotes(id),
    getEmployeeDocuments(id),
    getNextOneOnOneForEmployee(id),
    getPastOneOnOnesForEmployee(id),
  ]);

  const canViewDocuments = isAdmin || isOwnProfile || isDirectReport;
  const canEdit = isAdmin || isOwnProfile;

  const initials = getInitials(employee.firstName, employee.lastName);
  const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;
  const tenure = (() => {
    const ms = Date.now() - employee.startDate.getTime();
    const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    return years > 0 ? `${years} year${years > 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}` : `${months} month${months !== 1 ? "s" : ""}`;
  })();

  const statusColor = employee.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : employee.status === "ONBOARDING" ? "bg-blue-500/15 text-blue-400" : "bg-gray-500/15 text-gray-400";

  const addressParts = [employee.address, employee.city, employee.state, employee.zipCode, employee.country].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] overflow-hidden mb-6")}>
        <div className="px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {employee.profilePhoto ? (
              <img src={employee.profilePhoto} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className={cn("h-20 w-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold", avatarColors[colorIdx])}>
                {initials}
              </div>
            )}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--color-primary)]">{employee.firstName} {employee.lastName}</h1>
                {employee.pronouns && <span className="text-sm text-[var(--color-text-muted)]">({employee.pronouns})</span>}
                <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium w-fit", statusColor)}>{employee.status}</span>
              </div>
              <p className="text-[var(--color-text-muted)] mt-0.5">{employee.jobTitle} · {employee.department?.name || "No department"}</p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && employee.status === "ACTIVE" && (
                  <PromoteEmployeeDialog
                    employeeId={employee.id}
                    employeeName={`${employee.firstName} ${employee.lastName}`}
                    currentJobTitle={employee.jobTitle}
                    currentDepartmentId={employee.departmentId}
                    departments={(await db.department.findMany({ orderBy: { name: "asc" } })).map((d) => ({ id: d.id, name: d.name }))}
                  />
                )}
                <EditEmployeeDialog employee={{
                  id: employee.id,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  email: employee.email,
                  phone: employee.phone,
                  jobTitle: employee.jobTitle,
                  departmentId: employee.departmentId,
                  startDate: employee.startDate.toISOString().split("T")[0],
                  birthday: employee.birthday?.toISOString().split("T")[0] || "",
                  location: employee.location || "",
                  hobbies: employee.hobbies || "",
                  bio: employee.bio || "",
                  dietaryRestrictions: employee.dietaryRestrictions || "",
                  pronouns: employee.pronouns || "",
                  tShirtSize: employee.tShirtSize || "",
                  address: employee.address || "",
                  city: employee.city || "",
                  state: employee.state || "",
                  zipCode: employee.zipCode || "",
                  country: employee.country || "",
                  emergencyContactName: employee.emergencyContactName || "",
                  emergencyContactPhone: employee.emergencyContactPhone || "",
                  emergencyContactRelation: employee.emergencyContactRelation || "",
                }} departments={(await db.department.findMany({ orderBy: { name: "asc" } })).map((d) => ({ id: d.id, name: d.name }))} />
                {isAdmin && employee.status === "OFFBOARDED" && (
                  <ReactivateEmployeeButton
                    employeeId={employee.id}
                    employeeName={`${employee.firstName} ${employee.lastName}`}
                  />
                )}
                {isAdmin && (
                  <DeleteEmployeeButton employeeId={employee.id} employeeName={`${employee.firstName} ${employee.lastName}`} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {employee.bio && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">About</h2>
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{employee.bio}</p>
            </section>
          )}

          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow icon="mail" label="Email" value={employee.email} />
              {employee.phone && <InfoRow icon="phone" label="Phone" value={employee.phone} />}
              {employee.pronouns && <InfoRow icon="person" label="Pronouns" value={employee.pronouns} />}
              {employee.birthday && <InfoRow icon="calendar_today" label="Birthday" value={formatDate(employee.birthday)} />}
              <InfoRow icon="work" label="Start Date" value={formatDate(employee.startDate)} />
              {employee.location && <InfoRow icon="location_on" label="Location" value={employee.location} />}
              {fullAddress && <InfoRow icon="location_on" label="Address" value={fullAddress} />}
              <InfoRow icon="schedule" label="Tenure" value={tenure} />
              {employee.tShirtSize && <InfoRow icon="checkroom" label="T-Shirt Size" value={employee.tShirtSize} />}
              {employee.hobbies && <InfoRow icon="favorite" label="Hobbies" value={employee.hobbies} />}
              {employee.dietaryRestrictions && <InfoRow icon="restaurant" label="Dietary Restrictions" value={employee.dietaryRestrictions} />}
            </div>
          </section>

          {/* Emergency Contact */}
          {employee.emergencyContactName && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Emergency Contact</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <InfoRow icon="person" label="Name" value={employee.emergencyContactName} />
                {employee.emergencyContactPhone && <InfoRow icon="phone" label="Phone" value={employee.emergencyContactPhone} />}
                {employee.emergencyContactRelation && <InfoRow icon="shield" label="Relationship" value={employee.emergencyContactRelation} />}
              </div>
            </section>
          )}

          {nextOneOnOne && (canViewDocuments || isOwnProfile) && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
                    <Icon name="forum" size={20} className="text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Next 1:1</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                      {new Date(nextOneOnOne.scheduledAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      <span className="font-normal text-[var(--color-text-muted)]"> · with {nextOneOnOne.manager.firstName} {nextOneOnOne.manager.lastName}</span>
                    </p>
                  </div>
                </div>
                <Link
                  href={`/one-on-ones/${nextOneOnOne.id}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 inline-flex items-center gap-1"
                >
                  Open <Icon name="arrow_forward" size={14} />
                </Link>
              </div>
            </section>
          )}

          {canViewDocuments && (
            <EmployeeDocumentsSection
              employeeId={employee.id}
              documents={documents.map((d) => ({
                id: d.id,
                name: d.name,
                url: d.url,
                category: d.category,
                visibility: d.visibility,
                uploadedAt: d.uploadedAt.toISOString(),
              }))}
              isAdmin={isAdmin}
            />
          )}

          {isAdmin && (
            <div className="flex justify-end">
              <ResendStageDocsButton
                employeeId={employee.id}
                employeeName={`${employee.firstName} ${employee.lastName}`}
                stage="PRE_ONBOARDING"
              />
            </div>
          )}

          {isAdmin && (
            <HRNotesSection
              employeeId={employee.id}
              notes={hrNotes.map((n) => ({
                id: n.id,
                content: n.content,
                createdAt: n.createdAt.toISOString(),
                author: n.author,
              }))}
            />
          )}

          {(canViewDocuments || isOwnProfile) && pastOneOnOnes.length > 0 && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Past 1:1 Reviews</h2>
              <div className="space-y-3">
                {pastOneOnOnes.map((o) => {
                  const TYPE_LABEL: Record<typeof o.type, string> = {
                    THIRTY_DAY: "30-Day Check-In",
                    QUARTERLY: "Quarterly Review",
                    ANNUAL: "Annual Review",
                  };
                  return (
                    <details key={o.id} className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]">
                      <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Icon name="forum" size={14} className="text-[var(--color-accent)]" />
                          <span className="font-medium text-[var(--color-text-primary)]">{TYPE_LABEL[o.type]}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {o.completedAt ? formatDate(o.completedAt) : formatDate(o.scheduledAt)}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            · with {o.manager.firstName} {o.manager.lastName}
                          </span>
                        </div>
                        <Icon name="expand_more" size={16} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="px-4 pb-4 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                        {o.notebookMarkdown?.trim() ? (
                          o.notebookMarkdown
                        ) : (
                          <span className="text-[var(--color-text-muted)] italic">No notes recorded.</span>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          )}

          {canViewDocuments && employee.reviewsAsEmployee.length > 0 && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Performance Reviews</h2>
              <div className="space-y-4">
                {employee.reviewsAsEmployee.map((review) => (
                  <div key={review.id} className={cn("p-4 rounded-lg", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{review.cycle.name}</span>
                      {review.rating && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Icon name="star" size={16} fill={i < review.rating!} className={cn(i < review.rating! ? "text-amber-400" : "text-gray-600")} />
                          ))}
                        </div>
                      )}
                    </div>
                    {review.strengths && <p className="text-sm text-[var(--color-text-primary)]">{review.strengths}</p>}
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      {review.type} review by {review.reviewer.firstName} {review.reviewer.lastName}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {employee.gustoEmployeeId && (isAdmin || isOwnProfile) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Icon name="payments" size={20} />
                Gusto
              </h3>
              <EmployeeGustoTab gustoEmployeeId={employee.gustoEmployeeId} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          {employee.manager && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Reports To</h3>
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarColors[employee.manager.firstName.charCodeAt(0) % avatarColors.length])}>
                  {getInitials(employee.manager.firstName, employee.manager.lastName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{employee.manager.firstName} {employee.manager.lastName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{employee.manager.jobTitle}</p>
                </div>
              </div>
            </section>
          )}

          {(employee as any).buddy && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Onboarding Buddy</h3>
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarColors[(employee as any).buddy.firstName.charCodeAt(0) % avatarColors.length])}>
                  {getInitials((employee as any).buddy.firstName, (employee as any).buddy.lastName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{(employee as any).buddy.firstName} {(employee as any).buddy.lastName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{(employee as any).buddy.jobTitle}</p>
                </div>
              </div>
            </section>
          )}

          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Quick Info</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Direct Reports</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{employee.directReports.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Department</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{employee.department?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Tenure</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{tenure}</span>
              </div>
              {employee.location && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">Location</span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{employee.location}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
