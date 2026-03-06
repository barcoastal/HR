import { cn, formatDate } from "@/lib/utils";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { FileText, Download, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ResumeSearchFilter } from "./resume-search-filter";

export default async function ResumeDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; source?: string; from?: string; to?: string }>;
}) {
  await requireManagerOrAdmin();
  const params = await searchParams;

  const where: Record<string, unknown> = {
    resumeUrl: { not: null },
  };
  const andConditions: Record<string, unknown>[] = [];

  if (params.search) {
    andConditions.push({
      OR: [
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }

  if (params.source) {
    andConditions.push({ source: params.source });
  }

  if (params.from) {
    andConditions.push({ createdAt: { gte: new Date(params.from) } });
  }

  if (params.to) {
    andConditions.push({ createdAt: { lte: new Date(params.to) } });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const candidates = await db.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      source: true,
      resumeUrl: true,
      createdAt: true,
    },
  });

  const sources = await db.candidate.findMany({
    where: { resumeUrl: { not: null }, source: { not: null } },
    select: { source: true },
    distinct: ["source"],
  });
  const distinctSources = sources
    .map((s) => s.source)
    .filter((s): s is string => s !== null);

  return (
    <div className="max-w-full mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/cv"
          className="h-8 w-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-border)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--color-text-muted)]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Resume Database</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {candidates.length} resume{candidates.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      <ResumeSearchFilter sources={distinctSources} />

      <div className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Name</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Source</th>
              <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Date</th>
              <th className="text-right text-xs font-medium text-[var(--color-text-muted)] px-4 py-3">Resume</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-border)]/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                      <FileText className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {c.firstName} {c.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">{c.email}</td>
                <td className="px-4 py-3">
                  {c.source && (
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      c.source === "pro.jobing"
                        ? "bg-orange-500/10 text-orange-400"
                        : "bg-blue-500/10 text-blue-400"
                    )}>
                      {c.source}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                  {formatDate(c.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {c.resumeUrl && (
                    <a
                      href={`/api/platforms/jobing/resume?url=${encodeURIComponent(c.resumeUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium",
                        "bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                      )}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No resumes found matching your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
