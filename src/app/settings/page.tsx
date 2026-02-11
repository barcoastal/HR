import { cn } from "@/lib/utils";
import {
  Building,
  Save,
  Upload,
  Users,
  Shield,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

const teamMembers = [
  {
    name: "Sarah Chen",
    email: "sarah.chen@peoplehub.io",
    role: "Admin",
    initials: "SC",
    avatarColor: "bg-indigo-500",
  },
  {
    name: "Alex Rivera",
    email: "alex.rivera@peoplehub.io",
    role: "Manager",
    initials: "AR",
    avatarColor: "bg-emerald-500",
  },
  {
    name: "Priya Patel",
    email: "priya.patel@peoplehub.io",
    role: "Manager",
    initials: "PP",
    avatarColor: "bg-purple-500",
  },
  {
    name: "David Kim",
    email: "david.kim@peoplehub.io",
    role: "Viewer",
    initials: "DK",
    avatarColor: "bg-teal-500",
  },
  {
    name: "James O'Connor",
    email: "james.oconnor@peoplehub.io",
    role: "Manager",
    initials: "JO",
    avatarColor: "bg-cyan-500",
  },
];

const roleColors: Record<string, string> = {
  Admin: "bg-red-500/15 text-red-400",
  Manager: "bg-blue-500/15 text-blue-400",
  Viewer: "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
};

const checklistTemplates = [
  { name: "New Hire Onboarding", items: 14, lastUpdated: "Jan 15, 2025" },
  { name: "Employee Offboarding", items: 10, lastUpdated: "Dec 2, 2024" },
  { name: "Intern Onboarding", items: 8, lastUpdated: "Nov 20, 2024" },
];

function InputField({
  label,
  placeholder,
  defaultValue,
  type = "text",
}: {
  label: string;
  placeholder: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={cn(
          "w-full px-3 py-2 rounded-lg text-sm",
          "bg-[var(--color-background)] border border-[var(--color-border)]",
          "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
          "transition-all"
        )}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Manage your company settings, users, and templates
        </p>
      </div>

      <div className="space-y-8">
        {/* Company Info */}
        <section
          className={cn(
            "rounded-xl p-6",
            "bg-[var(--color-surface)] border border-[var(--color-border)]"
          )}
        >
          <div className="flex items-center gap-2 mb-5">
            <Building className="h-5 w-5 text-[var(--color-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Company Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <InputField
              label="Company Name"
              placeholder="Your company name"
              defaultValue="PeopleHub Inc."
            />
            <InputField
              label="Domain"
              placeholder="yourdomain.com"
              defaultValue="peoplehub.io"
            />
            <InputField
              label="Industry"
              placeholder="Technology, Healthcare, etc."
              defaultValue="Technology"
            />
            <InputField
              label="Company Size"
              placeholder="Number of employees"
              defaultValue="48"
            />
          </div>

          {/* Logo Upload */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Company Logo
            </label>
            <div
              className={cn(
                "flex items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed",
                "border-[var(--color-border)] hover:border-[var(--color-accent)]/50",
                "transition-colors cursor-pointer"
              )}
            >
              <Upload className="h-5 w-5 text-[var(--color-text-muted)]" />
              <div className="text-center">
                <p className="text-sm text-[var(--color-text-primary)]">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  SVG, PNG, or JPG (max 2MB)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)] transition-colors",
                "shadow-[0_0_12px_var(--color-accent-glow)]"
              )}
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        </section>

        {/* User Management */}
        <section
          className={cn(
            "rounded-xl p-6",
            "bg-[var(--color-surface)] border border-[var(--color-border)]"
          )}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                User Management
              </h2>
            </div>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)] transition-colors"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Invite User
            </button>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {teamMembers.map((member) => (
                  <tr
                    key={member.email}
                    className="hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                            member.avatarColor
                          )}
                        >
                          {member.initials}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-[var(--color-text-muted)]">
                      {member.email}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                          roleColors[member.role]
                        )}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                          aria-label={`Edit ${member.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                          aria-label={`Remove ${member.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.email}
                className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                        member.avatarColor
                      )}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {member.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{member.email}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      roleColors[member.role]
                    )}
                  >
                    {member.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Checklist Templates */}
        <section
          className={cn(
            "rounded-xl p-6",
            "bg-[var(--color-surface)] border border-[var(--color-border)]"
          )}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Checklist Templates
              </h2>
            </div>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)] transition-colors"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              New Template
            </button>
          </div>
          <div className="space-y-3">
            {checklistTemplates.map((template) => (
              <div
                key={template.name}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg",
                  "bg-[var(--color-background)] border border-[var(--color-border)]",
                  "hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {template.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {template.items} items · Updated {template.lastUpdated}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] transition-colors"
                    aria-label={`Edit ${template.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
