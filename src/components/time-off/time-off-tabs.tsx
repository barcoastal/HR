"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { RequestList } from "@/components/time-off/request-list";
import { WhosOutWidget } from "@/components/time-off/whos-out-widget";
import { TeamCalendar } from "@/components/time-off/team-calendar";
import { BurnoutAlerts } from "@/components/time-off/burnout-alerts";

type Props = {
  myRequests: any[];
  allRequests: any[];
  outToday: any[];
  calendarEntries: any[];
  burnoutEmployees: any[];
  currentEmployeeId: string;
  isApprover: boolean;
  currentYear: number;
  currentMonth: number;
};

export function TimeOffTabs({
  myRequests,
  allRequests,
  outToday,
  calendarEntries,
  burnoutEmployees,
  currentEmployeeId,
  isApprover,
  currentYear,
  currentMonth,
}: Props) {
  const tabs = [
    { id: "my", label: "My Requests" },
    ...(isApprover ? [{ id: "team", label: "Team Requests" }] : []),
    { id: "calendar", label: "Team Calendar" },
    { id: "out", label: "Who's Out" },
    ...(isApprover ? [{ id: "burnout", label: "Burnout Alerts" }] : []),
  ];

  const [activeTab, setActiveTab] = useState("my");

  return (
    <div>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        {activeTab === "my" && (
          <RequestList requests={myRequests} currentEmployeeId={currentEmployeeId} canApprove={false} />
        )}
        {activeTab === "team" && isApprover && (
          <RequestList requests={allRequests} currentEmployeeId={currentEmployeeId} canApprove={true} />
        )}
        {activeTab === "calendar" && (
          <TeamCalendar initialEntries={calendarEntries} initialYear={currentYear} initialMonth={currentMonth} />
        )}
        {activeTab === "out" && (
          <WhosOutWidget outToday={outToday} />
        )}
        {activeTab === "burnout" && isApprover && (
          <BurnoutAlerts employees={burnoutEmployees} />
        )}
      </div>
    </div>
  );
}
