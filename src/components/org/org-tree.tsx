"use client";

import { cn, getInitials } from "@/lib/utils";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type OrgEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  profilePhoto: string | null;
  departmentName: string | null;
  managerId: string | null;
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-teal-500"];

function buildTree(employees: OrgEmployee[]): Map<string | null, OrgEmployee[]> {
  const tree = new Map<string | null, OrgEmployee[]>();
  for (const emp of employees) {
    const key = emp.managerId;
    if (!tree.has(key)) tree.set(key, []);
    tree.get(key)!.push(emp);
  }
  return tree;
}

function OrgNode({
  employee,
  tree,
  depth,
}: {
  employee: OrgEmployee;
  tree: Map<string | null, OrgEmployee[]>;
  depth: number;
}) {
  const children = tree.get(employee.id) || [];
  const [expanded, setExpanded] = useState(depth < 2);
  const initials = getInitials(employee.firstName, employee.lastName);
  const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 py-2 px-3 rounded-xl transition-colors",
          "hover:bg-[var(--color-surface-hover)] group"
        )}
        style={{ paddingLeft: `${depth * 28 + 12}px` }}
      >
        {children.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <Link href={`/people/${employee.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          {employee.profilePhoto ? (
            <img src={employee.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0", avatarColors[colorIdx])}>
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              {employee.jobTitle}
              {employee.departmentName && ` · ${employee.departmentName}`}
            </p>
          </div>
          {children.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] shrink-0">
              <Users className="h-3 w-3" />
              {children.length}
            </span>
          )}
        </Link>
      </div>

      {expanded && children.length > 0 && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 border-l border-[var(--color-border)]/50"
            style={{ left: `${depth * 28 + 24}px` }}
          />
          {children.map((child) => (
            <OrgNode key={child.id} employee={child} tree={tree} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgTree({ employees }: { employees: OrgEmployee[] }) {
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
      <p className="text-center text-[var(--color-text-muted)] py-8 text-sm">
        No employees with manager assignments yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((root) => (
        <OrgNode key={root.id} employee={root} tree={tree} depth={0} />
      ))}
    </div>
  );
}
