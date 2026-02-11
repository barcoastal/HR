import { cn } from "@/lib/utils";
import {
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  Clock,
  Heart,
  FileText,
  Star,
  ChevronRight,
} from "lucide-react";

const employee = {
  name: "Sarah Chen",
  initials: "SC",
  avatarColor: "bg-indigo-500",
  title: "HR Director",
  department: "Human Resources",
  status: "Active",
  email: "sarah.chen@peoplehub.io",
  phone: "+1 (555) 234-5678",
  birthday: "March 15, 1988",
  startDate: "January 10, 2021",
  location: "San Francisco, CA",
  bio: "Passionate HR leader with 12+ years of experience building inclusive, high-performing workplace cultures. Previously led people operations at TechFlow and GreenLeaf Consulting. Believes that great companies are built by empowering great people.",
  hobbies: "Yoga, hiking, photography, cooking Asian fusion cuisine",
  manager: {
    name: "David Park",
    initials: "DP",
    title: "VP of Operations",
    avatarColor: "bg-sky-500",
  },
  directReports: 4,
  tenure: "4 years, 1 month",
};

const documents = [
  { name: "Employment Contract", date: "Jan 10, 2021", type: "PDF" },
  { name: "NDA Agreement", date: "Jan 10, 2021", type: "PDF" },
  { name: "Benefits Enrollment", date: "Feb 1, 2021", type: "PDF" },
  { name: "Performance Review — Q4 2024", date: "Dec 20, 2024", type: "PDF" },
];

const reviews = [
  {
    cycle: "Q4 2024",
    rating: 5,
    reviewer: "David Park",
    summary: "Exceptional leadership in rolling out the new HRIS platform.",
  },
  {
    cycle: "Q2 2024",
    rating: 4,
    reviewer: "David Park",
    summary: "Strong performance in talent acquisition and team development.",
  },
  {
    cycle: "Q4 2023",
    rating: 5,
    reviewer: "David Park",
    summary: "Led company-wide DEI initiative with outstanding results.",
  },
];

const tabs = ["Overview", "Documents", "Reviews"];

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[var(--color-accent)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function EmployeeProfilePage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Hero Section */}
      <div
        className={cn(
          "rounded-xl overflow-hidden mb-6",
          "bg-[var(--color-surface)] border border-[var(--color-border)]"
        )}
      >
        <div className="h-32 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 opacity-80" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div
              className={cn(
                "h-20 w-20 rounded-xl flex items-center justify-center text-white text-2xl font-bold ring-4 ring-[var(--color-surface)]",
                employee.avatarColor
              )}
            >
              {employee.initials}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {employee.name}
                </h1>
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 w-fit">
                  {employee.status}
                </span>
              </div>
              <p className="text-[var(--color-text-muted)] mt-0.5">
                {employee.title} · {employee.department}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation (static, Overview active) */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map((tab, idx) => (
          <button
            key={tab}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              idx === 0
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <section
            className={cn(
              "rounded-xl p-6",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">About</h2>
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
              {employee.bio}
            </p>
          </section>

          {/* Info Grid */}
          <section
            className={cn(
              "rounded-xl p-6",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-[var(--color-border)]">
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              <InfoRow icon={Phone} label="Phone" value={employee.phone} />
              <InfoRow icon={Calendar} label="Birthday" value={employee.birthday} />
              <InfoRow icon={Briefcase} label="Start Date" value={employee.startDate} />
              <InfoRow icon={MapPin} label="Location" value={employee.location} />
              <InfoRow icon={Clock} label="Tenure" value={employee.tenure} />
              <InfoRow icon={Heart} label="Hobbies" value={employee.hobbies} />
            </div>
          </section>

          {/* Documents */}
          <section
            className={cn(
              "rounded-xl p-6",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Documents
            </h2>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.name}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    "hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group"
                  )}
                >
                  <div className="h-9 w-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {doc.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {doc.type} · {doc.date}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </section>

          {/* Reviews */}
          <section
            className={cn(
              "rounded-xl p-6",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Performance Reviews
            </h2>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.cycle}
                  className={cn(
                    "p-4 rounded-lg",
                    "bg-[var(--color-background)] border border-[var(--color-border)]"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {review.cycle}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4",
                            i < review.rating
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-600"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-[var(--color-text-primary)]">{review.summary}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    Reviewed by {review.reviewer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Manager Card */}
          <section
            className={cn(
              "rounded-xl p-5",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Reports To
            </h3>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
                  employee.manager.avatarColor
                )}
              >
                {employee.manager.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {employee.manager.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {employee.manager.title}
                </p>
              </div>
            </div>
          </section>

          {/* Quick Stats */}
          <section
            className={cn(
              "rounded-xl p-5",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Quick Info
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Direct Reports</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {employee.directReports}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Department</span>
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400">
                  {employee.department}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Tenure</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {employee.tenure}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-muted)]">Location</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {employee.location}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
