import { cn } from "@/lib/utils";
import { getDepartments } from "@/lib/actions/departments";
import { getEmployees } from "@/lib/actions/employees";
import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { ManagerAssignment } from "@/components/org/manager-assignment";
import { OrgTree } from "@/components/org/org-tree";
import { Icon } from "@/components/ui/icon";
import { FAB } from "@/components/ui/fab";

// Client wrapper needed for FAB (server page)
import OrgFABWrapper from "./org-fab-wrapper";

export default async function OrgPage() {
  await requireManagerOrAdmin();
  const [departments, employees] = await Promise.all([getDepartments(), getEmployees()]);

  const activeEmployees = employees.filter((e) => e.status !== "OFFBOARDED");

  return (
    <div className="w-full p-10">
      {/* Editorial header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)] mb-2">
            Organization Structure
          </h2>
          <p className="text-[var(--color-on-surface-variant)] font-medium text-lg">
            Visualizing the flow of talent and leadership.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] font-bold rounded-xl flex items-center gap-2">
            <Icon name="filter_list" size={18} /> All Departments
          </button>
          <button className="px-5 py-2.5 bg-[var(--color-primary)] text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-[var(--color-primary)]/10">
            <Icon name="download" size={18} /> Export Chart
          </button>
        </div>
      </div>

      {/* Visual Org Tree */}
      <OrgTree
        employees={activeEmployees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          profilePhoto: e.profilePhoto,
          departmentName: e.department?.name || null,
          managerId: e.managerId,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />

      {/* Bento stats section */}
      <div className="mt-24 grid grid-cols-4 gap-6">
        {/* Org Health card — col-span-2 */}
        <div className="col-span-2 bg-[var(--color-surface-container-highest)]/30 rounded-2xl p-8 backdrop-blur-sm border border-[var(--color-outline-variant)]/10">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-xl font-bold text-[var(--color-on-surface)]">Org Health Overview</h3>
            <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Real-time Data
            </span>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-3xl font-black text-[var(--color-primary)]">{activeEmployees.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">
                Total Employees
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-[var(--color-on-surface)]">
                {activeEmployees.length > 0
                  ? Math.round(
                      (activeEmployees.filter((e) => e.status === "ACTIVE").length /
                        activeEmployees.length) *
                        100
                    )
                  : 0}
                %
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">
                Retention Rate
              </p>
            </div>
            <div>
              <p className="text-3xl font-black text-[var(--color-on-surface)]">{departments.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">
                Departments
              </p>
            </div>
          </div>
        </div>

        {/* Growth card — 1 col */}
        <div className="bg-[var(--color-primary-container)] rounded-2xl p-8 text-white">
          <Icon name="trending_up" size={32} className="mb-4 opacity-80" />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">Projected Growth</p>
          <p className="text-4xl font-black">12%</p>
          <p className="text-sm opacity-70 mt-2">Year over year</p>
        </div>

        {/* Inter-Team card — 1 col */}
        <div className="bg-white rounded-2xl p-8 border border-[var(--color-outline-variant)]/10">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] mb-4">
            <Icon name="hub" />
          </div>
          <h4 className="font-bold text-[var(--color-on-surface)] mb-1">Inter-Team Connections</h4>
          <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">Cross-department collaboration</p>
          <div className="flex -space-x-2">
            {activeEmployees.slice(0, 5).map((emp) =>
              emp.profilePhoto ? (
                <img
                  key={emp.id}
                  className="w-8 h-8 rounded-full border-2 border-white object-cover"
                  src={emp.profilePhoto}
                  alt=""
                />
              ) : (
                <div
                  key={emp.id}
                  className="w-8 h-8 rounded-full border-2 border-white bg-[var(--color-primary-fixed)] flex items-center justify-center text-xs font-bold text-[var(--color-on-primary-fixed-variant)]"
                >
                  {emp.firstName[0]}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Manager Assignment section */}
      <div id="dept-actions" className="mt-12">
        <ManagerAssignment
          employees={activeEmployees.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            jobTitle: e.jobTitle,
            departmentName: e.department?.name || null,
            managerId: e.managerId,
            managerName: e.managerId
              ? (() => {
                  const mgr = activeEmployees.find((m) => m.id === e.managerId);
                  return mgr ? `${mgr.firstName} ${mgr.lastName}` : null;
                })()
              : null,
          }))}
        />
      </div>

      {/* FAB — client component wrapper */}
      <OrgFABWrapper />
    </div>
  );
}
