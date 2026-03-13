"use client";

import { cn } from "@/lib/utils";
import { toggleEmployeeTask } from "@/lib/actions/employees";
import { useState } from "react";
import { CheckCircle2, Circle, User } from "lucide-react";

type AssignedTask = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "DONE";
  completedAt: string | null;
  dueDay: number | null;
  employeeName: string;
  employeeId: string;
};

export function MyOnboardingTasks({ tasks }: { tasks: AssignedTask[] }) {
  const [localTasks, setLocalTasks] = useState(tasks);

  if (localTasks.length === 0) return null;

  // Group by employee
  const grouped = localTasks.reduce<Record<string, { name: string; tasks: AssignedTask[] }>>((acc, task) => {
    if (!acc[task.employeeId]) {
      acc[task.employeeId] = { name: task.employeeName, tasks: [] };
    }
    acc[task.employeeId].tasks.push(task);
    return acc;
  }, {});

  const handleToggle = async (taskId: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === "DONE" ? "PENDING" : "DONE", completedAt: t.status === "DONE" ? null : new Date().toISOString() }
          : t
      )
    );
    await toggleEmployeeTask(taskId);
  };

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">My Onboarding Tasks</h2>
      <div className="space-y-4">
        {Object.entries(grouped).map(([empId, group]) => (
          <div key={empId} className={cn("rounded-2xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Tasks for {group.name}</span>
            </div>
            <div className="space-y-2">
              {group.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleToggle(task.id)}
                  className="flex items-start gap-3 w-full text-left p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  {task.status === "DONE" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn("text-sm", task.status === "DONE" ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]")}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{task.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
