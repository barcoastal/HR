import { cn, getInitials, formatDate } from "@/lib/utils";
import { getEmployeeById } from "@/lib/actions/employees";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import {
  Mail, Phone, Calendar, MapPin, Briefcase, Clock, Heart, FileText, Star, ChevronRight, UtensilsCrossed,
} from "lucide-react";
import { EditEmployeeDialog } from "@/components/people/edit-employee-dialog";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
        <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const initials = getInitials(employee.firstName, employee.lastName);
  const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;
  const tenure = (() => {
    const ms = Date.now() - employee.startDate.getTime();
    const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    return years > 0 ? `${years} year${years > 1 ? "s" : ""}, ${months} month${months !== 1 ? "s" : ""}` : `${months} month${months !== 1 ? "s" : ""}`;
  })();

  const statusColor = employee.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : employee.status === "ONBOARDING" ? "bg-blue-500/15 text-blue-400" : "bg-gray-500/15 text-gray-400";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className={cn("rounded-xl overflow-hidden mb-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={cn("h-16 w-16 rounded-xl flex items-center justify-center text-white text-xl font-bold", avatarColors[colorIdx])}>
              {initials}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{employee.firstName} {employee.lastName}</h1>
                <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium w-fit", statusColor)}>{employee.status}</span>
              </div>
              <p className="text-[var(--color-text-muted)] mt-0.5">{employee.jobTitle} · {employee.department?.name || "No department"}</p>
            </div>
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
            }} departments={(await db.department.findMany({ orderBy: { name: "asc" } })).map((d) => ({ id: d.id, name: d.name }))} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {employee.bio && (
            <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">About</h2>
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{employee.bio}</p>
            </section>
          )}

          <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              {employee.phone && <InfoRow icon={Phone} label="Phone" value={employee.phone} />}
              {employee.birthday && <InfoRow icon={Calendar} label="Birthday" value={formatDate(employee.birthday)} />}
              <InfoRow icon={Briefcase} label="Start Date" value={formatDate(employee.startDate)} />
              {employee.location && <InfoRow icon={MapPin} label="Location" value={employee.location} />}
              <InfoRow icon={Clock} label="Tenure" value={tenure} />
              {employee.hobbies && <InfoRow icon={Heart} label="Hobbies" value={employee.hobbies} />}
              {employee.dietaryRestrictions && <InfoRow icon={UtensilsCrossed} label="Dietary Restrictions" value={employee.dietaryRestrictions} />}
            </div>
          </section>

          {employee.documents.length > 0 && (
            <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Documents</h2>
              <div className="space-y-2">
                {employee.documents.map((doc) => (
                  <div key={doc.id} className={cn("flex items-center gap-3 p-3 rounded-lg", "hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group")}>
                    <div className="h-9 w-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-red-400" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{doc.category} · {formatDate(doc.uploadedAt)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {employee.reviewsAsEmployee.length > 0 && (
            <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Performance Reviews</h2>
              <div className="space-y-4">
                {employee.reviewsAsEmployee.map((review) => (
                  <div key={review.id} className={cn("p-4 rounded-lg", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{review.cycle.name}</span>
                      {review.rating && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-4 w-4", i < review.rating! ? "text-amber-400 fill-amber-400" : "text-gray-600")} />
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
        </div>

        <div className="space-y-6">
          {employee.manager && (
            <section className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
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

          <section className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
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
