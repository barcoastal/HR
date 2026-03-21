"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

type OrgEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  profilePhoto: string | null;
  departmentName: string | null;
  managerId: string | null;
};

function buildTree(employees: OrgEmployee[]): Map<string | null, OrgEmployee[]> {
  const tree = new Map<string | null, OrgEmployee[]>();
  for (const emp of employees) {
    const key = emp.managerId;
    if (!tree.has(key)) tree.set(key, []);
    tree.get(key)!.push(emp);
  }
  return tree;
}

function CEONode({ employee }: { employee: OrgEmployee }) {
  const initials = getInitials(employee.firstName, employee.lastName);
  return (
    <div className="flex flex-col items-center">
      <div className="w-72 bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center text-center border border-[var(--color-outline-variant)]/20">
        <div className="bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-primary-container)] p-1 rounded-2xl mb-4">
          {employee.profilePhoto ? (
            <img
              src={employee.profilePhoto}
              alt=""
              className="w-20 h-20 rounded-[14px] object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-[14px] bg-[var(--color-primary-fixed)] flex items-center justify-center text-[var(--color-on-primary-fixed-variant)] text-2xl font-black">
              {initials}
            </div>
          )}
        </div>
        <p className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1">
          {employee.jobTitle}
        </p>
        <p className="text-lg font-black text-[var(--color-on-surface)] mb-1">
          {employee.firstName} {employee.lastName}
        </p>
        {employee.departmentName && (
          <p className="text-xs text-[var(--color-on-surface-variant)] mb-4">{employee.departmentName}</p>
        )}
        <div className="flex gap-2 w-full">
          <Link
            href={`/people/${employee.id}`}
            className="flex-1 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold text-center hover:opacity-90 transition-opacity"
          >
            Profile
          </Link>
          <a
            href={`mailto:`}
            className="flex-1 py-2 rounded-xl border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] text-xs font-bold text-center hover:bg-[var(--color-surface-container)] transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}

function RecursiveNode({
  employee,
  tree,
  depth = 0,
}: {
  employee: OrgEmployee;
  tree: Map<string | null, OrgEmployee[]>;
  depth?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const reports = tree.get(employee.id) || [];
  const hasReports = reports.length > 0;
  const MAX_SHOWN = 5;
  const visible = showAll ? reports : reports.slice(0, MAX_SHOWN);
  const overflow = reports.length - MAX_SHOWN;
  const initials = getInitials(employee.firstName, employee.lastName);

  // Nodes with reports render as a manager card; leaf nodes as team cards
  if (!hasReports && depth > 1) {
    return <TeamCard employee={employee} />;
  }

  return (
    <div className="flex flex-col items-center">
      {/* Connector from parent */}
      <div className="org-line-vertical h-8" />

      {/* Manager/employee card */}
      <div className="w-64 bg-white rounded-2xl border-2 border-[var(--color-primary)]/30 p-5 flex flex-col items-center text-center shadow-md hover:shadow-lg transition-shadow">
        <Link href={`/people/${employee.id}`} className="flex flex-col items-center gap-3 w-full">
          {employee.profilePhoto ? (
            <img
              src={employee.profilePhoto}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-[var(--color-primary)]/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-fixed)] flex items-center justify-center text-[var(--color-on-primary-fixed-variant)] text-lg font-black border-2 border-[var(--color-primary)]/20">
              {initials}
            </div>
          )}
          <div>
            <p className="text-sm font-black text-[var(--color-on-surface)]">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="text-xs text-[var(--color-primary)] font-semibold mt-0.5">{employee.jobTitle}</p>
            {employee.departmentName && (
              <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">{employee.departmentName}</p>
            )}
          </div>
        </Link>
        {hasReports && (
          <span className="mt-2 text-[10px] font-bold text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container)] px-2 py-0.5 rounded-full">
            {reports.length} report{reports.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Recursive reports */}
      {hasReports && (
        <>
          <div className="org-line-vertical h-8" />
          <div className="flex flex-col items-center gap-2 w-full">
            {visible.map((member) => {
              const memberReports = tree.get(member.id) || [];
              if (memberReports.length > 0) {
                // This member has their own reports — render recursively
                return (
                  <RecursiveNode
                    key={member.id}
                    employee={member}
                    tree={tree}
                    depth={depth + 1}
                  />
                );
              }
              return <TeamCard key={member.id} employee={member} />;
            })}
            {!showAll && overflow > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-56 py-2 rounded-xl bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)] text-xs font-bold hover:bg-[var(--color-surface-container-high)] transition-colors"
              >
                View {overflow} more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DirectorColumn({
  director,
  tree,
}: {
  director: OrgEmployee;
  tree: Map<string | null, OrgEmployee[]>;
}) {
  return (
    <RecursiveNode employee={director} tree={tree} depth={1} />
  );
}

function TeamCard({ employee }: { employee: OrgEmployee }) {
  const initials = getInitials(employee.firstName, employee.lastName);
  return (
    <Link href={`/people/${employee.id}`} className="block">
      <div className="bg-[var(--color-surface-container)] rounded-xl border-l-4 border-[var(--color-primary)] w-56 p-3 flex items-center gap-3 hover:bg-[var(--color-surface-container-high)] transition-colors">
        {employee.profilePhoto ? (
          <img
            src={employee.profilePhoto}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-fixed)] flex items-center justify-center text-[var(--color-on-primary-fixed-variant)] text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--color-on-surface)] truncate">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="text-[10px] text-[var(--color-on-surface-variant)] truncate">{employee.jobTitle}</p>
        </div>
      </div>
    </Link>
  );
}

export function OrgTree({
  employees,
  departments,
}: {
  employees: OrgEmployee[];
  departments: { id: string; name: string }[];
}) {
  const tree = buildTree(employees);

  // Find root nodes: employees whose managerId is null or whose manager isn't in the list
  const employeeIds = new Set(employees.map((e) => e.id));
  const roots = employees.filter(
    (e) => !e.managerId || !employeeIds.has(e.managerId)
  );

  // Sort roots: those with most reports first
  roots.sort((a, b) => {
    const aCount = tree.get(a.id)?.length || 0;
    const bCount = tree.get(b.id)?.length || 0;
    return bCount - aCount;
  });

  if (employees.length === 0) {
    return (
      <p className="text-center text-[var(--color-on-surface-variant)] py-8 text-sm">
        No employees with manager assignments yet.
      </p>
    );
  }

  // CEO is root with most reports (first in sorted list)
  const [ceo, ...directors] = roots;

  return (
    <div className="flex flex-col items-center overflow-x-auto pb-8">
      {/* CEO node */}
      {ceo && <CEONode employee={ceo} />}

      {/* Vertical gradient connector from CEO down */}
      {directors.length > 0 && (
        <>
          <div className="org-line-vertical h-16" />

          {/* Horizontal connector bar across all director columns */}
          <div className="relative w-full flex justify-center">
            <div
              className="org-line-horizontal absolute top-0"
              style={{
                width: `${Math.min(directors.length, 6) * 17}rem`,
                maxWidth: "90%",
              }}
            />
          </div>

          {/* Director columns */}
          <div className="flex gap-4 items-start pt-0 mt-0">
            {directors.map((director) => (
              <DirectorColumn key={director.id} director={director} tree={tree} />
            ))}
          </div>
        </>
      )}

      {/* If only CEO with no directors, show their direct reports inline */}
      {directors.length === 0 && ceo && (tree.get(ceo.id) || []).length > 0 && (
        <>
          <div className="org-line-vertical h-16" />
          <div className="relative w-full flex justify-center">
            <div
              className="org-line-horizontal absolute top-0"
              style={{
                width: `${Math.min((tree.get(ceo.id) || []).length, 6) * 17}rem`,
                maxWidth: "90%",
              }}
            />
          </div>
          <div className="flex gap-4 items-start pt-0 mt-0 flex-wrap justify-center">
            {(tree.get(ceo.id) || []).map((member) => (
              <RecursiveNode key={member.id} employee={member} tree={tree} depth={1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
