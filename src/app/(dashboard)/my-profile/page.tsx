import { cn, getInitials, formatDate } from "@/lib/utils";
import { getMyProfile } from "@/lib/actions/my-profile";
import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { EditPersonalInfoDialog } from "@/components/my-profile/edit-personal-info-dialog";
import { EditEmergencyContactDialog } from "@/components/my-profile/edit-emergency-contact-dialog";
import { EditAboutDialog } from "@/components/my-profile/edit-about-dialog";
import { ProfilePhotoUpload } from "@/components/my-profile/profile-photo-upload";
import { Icon } from "@/components/ui/icon";
import { NotificationPreferencesPanel } from "@/components/my-profile/notification-preferences";
import { getNotificationPreferences } from "@/lib/actions/notification-preferences";
import { db } from "@/lib/db";
import { getMyDocuments } from "@/lib/actions/my-documents";
import Link from "next/link";

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

export default async function MyProfilePage() {
  const session = await requireAuth();
  if (!session.user.employeeId) redirect("/");

  const profile = await getMyProfile(session.user.employeeId);
  if (!profile) redirect("/");

  const notifPrefs = await getNotificationPreferences(session.user.id);
  const myDocs = (await getMyDocuments()).slice(0, 5);

  const initials = getInitials(profile.firstName, profile.lastName);
  const colorIdx = profile.firstName.charCodeAt(0) % avatarColors.length;
  const tenure = (() => {
    const ms = Date.now() - profile.startDate.getTime();
    const years = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    return years > 0 ? `${years}y ${months}m` : `${months}m`;
  })();

  const addressParts = [profile.address, profile.city, profile.state, profile.zipCode, profile.country].filter(Boolean);
  const fullAddress = addressParts.join(", ");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] overflow-hidden mb-6")}>
        <div className="px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <ProfilePhotoUpload
              employeeId={profile.id}
              currentPhoto={profile.profilePhoto}
              initials={initials}
              colorClass={avatarColors[colorIdx]}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--color-primary)]">{profile.firstName} {profile.lastName}</h1>
                {profile.pronouns && <span className="text-sm text-[var(--color-text-muted)]">({profile.pronouns})</span>}
              </div>
              <p className="text-[var(--color-text-muted)] mt-0.5">{profile.jobTitle} · {profile.department?.name || "No department"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* My Documents */}
          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Icon name="folder" size={18} className="text-[var(--color-accent)]" />
                My Documents
              </h2>
              <Link href="/my-documents" className="text-xs font-medium text-[var(--color-accent)] hover:underline">
                View all →
              </Link>
            </div>
            {myDocs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] italic">No documents yet.</p>
            ) : (
              <div className="space-y-1.5">
                {myDocs.map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-bg)] transition-colors"
                  >
                    <Icon name="picture_as_pdf" size={16} className="text-red-400 shrink-0" />
                    <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">{d.name}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-semibold",
                      d.status === "SIGNED" ? "bg-emerald-500/10 text-emerald-700"
                      : d.status === "AWAITING_COUNTERSIGN" ? "bg-purple-500/10 text-purple-700"
                      : d.status === "PENDING" || d.status === "VIEWED" ? "bg-amber-500/10 text-amber-700"
                      : "bg-gray-500/10 text-gray-600"
                    )}>
                      {d.status === "SIGNED" ? "Signed"
                        : d.status === "AWAITING_COUNTERSIGN" ? "Awaiting countersign"
                        : d.status === "PENDING" || d.status === "VIEWED" ? "Needs signature"
                        : "On file"}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* About */}
          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">About</h2>
              <EditAboutDialog data={{
                employeeId: profile.id,
                bio: profile.bio || "",
                hobbies: profile.hobbies || "",
                dietaryRestrictions: profile.dietaryRestrictions || "",
              }} />
            </div>
            {profile.bio ? (
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{profile.bio}</p>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] italic">Add a bio to tell your colleagues about yourself.</p>
            )}
            {profile.hobbies && <InfoRow icon="favorite" label="Hobbies" value={profile.hobbies} />}
            {profile.dietaryRestrictions && <InfoRow icon="restaurant" label="Dietary Restrictions" value={profile.dietaryRestrictions} />}
          </section>

          {/* Personal Info */}
          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Personal Info</h2>
              <EditPersonalInfoDialog data={{
                employeeId: profile.id,
                address: profile.address || "",
                city: profile.city || "",
                state: profile.state || "",
                zipCode: profile.zipCode || "",
                country: profile.country || "",
                pronouns: profile.pronouns || "",
                tShirtSize: profile.tShirtSize || "",
              }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <InfoRow icon="mail" label="Email" value={profile.email} />
              {profile.phone && <InfoRow icon="phone" label="Phone" value={profile.phone} />}
              {fullAddress && <InfoRow icon="location_on" label="Address" value={fullAddress} />}
              {profile.pronouns && <InfoRow icon="person" label="Pronouns" value={profile.pronouns} />}
              {profile.tShirtSize && <InfoRow icon="checkroom" label="T-Shirt Size" value={profile.tShirtSize} />}
              <InfoRow icon="work" label="Start Date" value={formatDate(profile.startDate)} />
              <InfoRow icon="schedule" label="Tenure" value={tenure} />
            </div>
          </section>

          {/* Emergency Contact */}
          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Emergency Contact</h2>
              <EditEmergencyContactDialog data={{
                employeeId: profile.id,
                emergencyContactName: profile.emergencyContactName || "",
                emergencyContactPhone: profile.emergencyContactPhone || "",
                emergencyContactRelation: profile.emergencyContactRelation || "",
              }} />
            </div>
            {profile.emergencyContactName ? (
              <div className="space-y-1">
                <InfoRow icon="person" label="Name" value={profile.emergencyContactName} />
                {profile.emergencyContactPhone && <InfoRow icon="phone" label="Phone" value={profile.emergencyContactPhone} />}
                {profile.emergencyContactRelation && <InfoRow icon="shield" label="Relationship" value={profile.emergencyContactRelation} />}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] italic">No emergency contact on file. Please add one.</p>
            )}
          </section>

          {/* Notification Preferences */}
          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Notifications</h2>
            <NotificationPreferencesPanel
              userId={session.user.id}
              initialPrefs={notifPrefs}
            />
          </section>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {profile.buddy && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Your Buddy</h3>
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarColors[profile.buddy.firstName.charCodeAt(0) % avatarColors.length])}>
                  {getInitials(profile.buddy.firstName, profile.buddy.lastName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{profile.buddy.firstName} {profile.buddy.lastName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{profile.buddy.jobTitle}</p>
                </div>
              </div>
            </section>
          )}

          {profile.manager && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Reports To</h3>
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm", avatarColors[profile.manager.firstName.charCodeAt(0) % avatarColors.length])}>
                  {getInitials(profile.manager.firstName, profile.manager.lastName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{profile.manager.firstName} {profile.manager.lastName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{profile.manager.jobTitle}</p>
                </div>
              </div>
            </section>
          )}

          {profile.clubMemberships.length > 0 && (
            <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-5")}>
              <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">My Clubs</h3>
              <div className="space-y-2">
                {profile.clubMemberships.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="text-lg">{m.club.emoji}</span>
                    <span className="text-sm text-[var(--color-text-primary)]">{m.club.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
