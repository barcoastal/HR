# Page Redesigns — Stitch Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from Lucide React to Material Symbols Outlined, add new design tokens, and redesign People Directory, Org Chart, and Calendar pages to match Stitch reference designs.

**Architecture:** Foundation-first approach. Create the Icon wrapper component and add the font, then mechanically migrate all 88 files from Lucide to Material Symbols. Then build shared components (FAB), then redesign each page one at a time. Each page redesign rewrites the main component file while keeping server-side data fetching unchanged.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Material Symbols Outlined (Google Fonts), Framer Motion, CVA

**Spec:** `docs/superpowers/specs/2026-03-21-page-redesigns-stitch-alignment.md`

---

## Chunk 1: Shared Foundation

### Task 1: Create Icon Component and Load Font

**Files:**
- Create: `src/components/ui/icon.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create the Icon component**

Create `src/components/ui/icon.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface IconProps {
  name: string;
  fill?: boolean;
  size?: number;
  className?: string;
}

export function Icon({ name, fill = false, size = 24, className }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined select-none", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}
```

- [ ] **Step 2: Add Material Symbols font to layout.tsx**

In `src/app/layout.tsx`, add a `<link>` tag inside `<head>` (or before `<body>`):

```tsx
<html lang="en">
  <head>
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />
  </head>
  <body className="antialiased">
```

Note: The `<html>` tag needs to be updated to include `<head>` explicitly since the current layout doesn't have one. Only add the font `<link>` tag — do NOT duplicate `<title>` or `<meta>` tags, as the `metadata` export in layout.tsx handles those automatically via Next.js.

- [ ] **Step 3: Add new design tokens to globals.css**

Add these tokens inside the existing `@theme { }` block in `src/app/globals.css`:

```css
/* Tertiary — teal accent */
--color-tertiary: #00628b;
--color-tertiary-container: #007caf;
--color-tertiary-fixed: #c7e7ff;
--color-on-tertiary-fixed-variant: #004c6c;

/* Error container */
--color-error-container: #ffdad6;
--color-on-error-container: #93000a;

/* Inverse */
--color-inverse-surface: #2f2f3c;
--color-inverse-primary: #c9bfff;

/* Additional surface/outline */
--color-outline: #797587;
--color-surface-container-high: #e9e6f8;
--color-primary-fixed-dim: #c9bfff;

/* Radius — editorial containers */
--radius-xl: 2rem;
```

- [ ] **Step 4: Add org tree connector classes and spinner animation to globals.css**

Add after the existing utility classes:

```css
/* Org tree connectors */
.org-line-vertical {
  width: 2px;
  background: linear-gradient(to bottom, #7459f7 0%, #e3e0f2 100%);
}
.org-line-horizontal {
  height: 2px;
  background: #e3e0f2;
}

/* Spinner for loading states (replaces Loader2 animate-spin) */
@keyframes material-spin {
  to { transform: rotate(360deg); }
}
.animate-material-spin {
  animation: material-spin 1s linear infinite;
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/icon.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: add Icon component, Material Symbols font, and new design tokens"
```

---

### Task 2: Create FAB Component

**Files:**
- Create: `src/components/ui/fab.tsx`

- [ ] **Step 1: Create the FAB component**

Create `src/components/ui/fab.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface FABProps {
  icon: string;
  variant?: "gradient" | "solid";
  onClick?: () => void;
  className?: string;
}

export function FAB({ icon, variant = "solid", onClick, className }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-8 right-8 z-50 flex items-center justify-center",
        "shadow-2xl shadow-[var(--color-primary)]/40",
        "hover:scale-110 active:scale-95 transition-all",
        variant === "gradient"
          ? "w-14 h-14 gradient-primary rounded-2xl"
          : "w-16 h-16 bg-[var(--color-primary)] rounded-full",
        "text-white",
        className
      )}
    >
      <Icon name={icon} size={28} />
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/fab.tsx
git commit -m "feat: add FAB (floating action button) component"
```

---

### Task 3: Migrate Icon Library — Layout Components (sidebar, top-bar, mobile-nav)

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/top-bar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

**Migration pattern for ALL icon migration tasks:**
1. Remove the `import { ... } from "lucide-react"` line
2. Add `import { Icon } from "@/components/ui/icon"`
3. Replace each `<LucideIcon className="h-N w-N" />` with `<Icon name="material_name" size={N*4} className="..." />`
4. For Lucide icons used as values (e.g., `icon: Newspaper`), change to `icon: "newspaper"` and update the rendering to use `<Icon name={item.icon} />`

**Icon mapping for sidebar.tsx:**
- `Newspaper` → `"newspaper"`
- `Users` → `"group"`
- `Building2` → `"business"`
- `UserPlus` → `"person_add"`
- `UserMinus` → `"person_remove"`
- `ClipboardCheck` → `"assignment_turned_in"`
- `Settings` → `"settings"`
- `Briefcase` → `"work"`
- `BarChart3` → `"bar_chart"`
- `CalendarDays` → `"calendar_month"`
- `LogOut` → `"logout"`
- `Palmtree` → `"beach_access"`
- `Users2` → `"groups"`
- `Megaphone` → `"campaign"`
- `UserCircle` → `"account_circle"`
- `FileSignature` → `"draw"`

The sidebar nav links array currently stores Lucide component references (`icon: Newspaper`). Change to store string names (`icon: "newspaper"`) and render with `<Icon name={link.icon} size={20} fill={isActive} />`.

**Icon mapping for top-bar.tsx:**
- `Bell` → `"notifications"`
- `Search` → `"search"`

**Icon mapping for mobile-nav.tsx:**
Uses the same nav link structure as sidebar but only a subset of icons. Additionally:
- `Menu` → `"menu"`
- `X` → `"close"`
Note: mobile-nav may not include all sidebar icons (e.g., `FileSignature`). Only replace icons that are actually imported.

- [ ] **Step 1: Migrate sidebar.tsx**

Update the `allNavLinks` array to use string icon names instead of component references. Update the nav rendering to use `<Icon>`. Remove lucide-react import. Add Icon import.

- [ ] **Step 2: Migrate top-bar.tsx**

Replace `Bell` and `Search` with `<Icon>` equivalents. Remove lucide-react import.

- [ ] **Step 3: Migrate mobile-nav.tsx**

Same pattern as sidebar. The mobile nav duplicates the nav link structure — update to use string icon names and `<Icon>`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/top-bar.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: migrate layout components from Lucide to Material Symbols"
```

---

### Task 4: Migrate Icon Library — UI Components

**Files:**
- Modify: `src/components/ui/dialog.tsx` (`X` → `"close"`)

Note: `page-header.tsx` and `stat-card.tsx` do not import from `lucide-react` — no changes needed.

- [ ] **Step 1: Migrate dialog.tsx**

Replace `X` from lucide-react with `<Icon name="close" />`.

- [ ] **Step 2: Verify build and commit**

```bash
git add src/components/ui/
git commit -m "feat: migrate UI components from Lucide to Material Symbols"
```

---

### Task 5: Migrate Icon Library — All Remaining Files (Batch)

**Files:** ~82 remaining files across: dashboard pages, people components, org components, calendar, CV/recruitment, feed, onboarding, reviews, settings, time-off, documents, signing, my-profile, and misc.

This is mechanical work. For each file:
1. Remove `import { ... } from "lucide-react"`
2. Add `import { Icon } from "@/components/ui/icon"`
3. Replace each `<LucideIcon className="h-N w-N ..." />` with `<Icon name="mapped_name" size={N*4} className="..." />`
4. For `Loader2` with `animate-spin`, use `<Icon name="progress_activity" className="animate-material-spin" />`
5. For icons passed as props/stored in variables, change to string names
6. For `Linkedin`, keep as inline SVG or use `<Icon name="link" />`

Refer to **Appendix A** in the spec for the complete mapping table.

**Important size mapping:**
- `h-3 w-3` (12px) → `size={12}`
- `h-3.5 w-3.5` (14px) → `size={14}`
- `h-4 w-4` (16px) → `size={16}`
- `h-5 w-5` (20px) → `size={20}`
- `h-6 w-6` (24px) → `size={24}` (default, can omit)

- [ ] **Step 1: Migrate dashboard page files (12 files)**

All files in `src/app/(dashboard)/*/page.tsx` that import lucide-react. Mechanical replacement using the mapping table.

- [ ] **Step 2: Migrate people components (6 files)**

`people-list.tsx`, `add-employee-form.tsx`, `bulk-employee-import.tsx`, `delete-employee-button.tsx`, `edit-employee-dialog.tsx`, `employee-documents-section.tsx`, `hr-notes-section.tsx`

- [ ] **Step 3: Migrate org components (3 files)**

`org-tree.tsx`, `manager-assignment.tsx`, `department-actions.tsx`

- [ ] **Step 4: Migrate CV/recruitment components (11 files)**

All files in `src/components/cv/`

- [ ] **Step 5: Migrate feed, onboarding, reviews components (13 files)**

`src/components/feed/`, `src/components/onboarding/`, `src/components/reviews/`

- [ ] **Step 6: Migrate settings components (16 files)**

All files in `src/components/settings/`

- [ ] **Step 7: Migrate remaining components (time-off, documents, signing, my-profile, offboarding, misc) (~20 files)**

`src/components/time-off/`, `src/components/documents/`, `src/components/signing/`, `src/components/my-profile/`, `src/components/offboarding/` (including `start-offboarding-dialog.tsx`), `src/components/analytics/`, `src/components/clubs/`, `src/components/pulse/`, `src/components/voice/`, `src/components/feedback/`, `src/app/(public)/sign/`, `src/app/(public)/login/page.tsx`

- [ ] **Step 8: Remove lucide-react from package.json**

```bash
npm uninstall lucide-react
```

- [ ] **Step 9: Verify no remaining lucide imports**

```bash
grep -r "lucide-react" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results.

- [ ] **Step 10: Full build verification**

Run: `npm run build`
Expected: Build succeeds with zero errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: complete icon migration from Lucide React to Material Symbols Outlined

Migrated ~88 files, ~90 unique icons. Removed lucide-react dependency."
```

---

## Chunk 2: People Directory Redesign

### Task 6: Redesign People Directory Page

**Files:**
- Modify: `src/app/(dashboard)/people/page.tsx`
- Rewrite: `src/components/people/people-list.tsx`

**Reference:** Stitch design at `/tmp/stitch-screens/people-directory.html`

- [ ] **Step 1: Update the server page component**

Modify `src/app/(dashboard)/people/page.tsx`:

- Remove `PageHeader` import and usage
- Build a departments-with-counts array for team row cards:
  ```tsx
  const departmentsWithCounts = departments.map(d => ({
    name: d.name,
    memberCount: employees.filter(e => e.department?.name === d.name).length,
  }));
  ```
- Add editorial header directly in the JSX:
  ```tsx
  <div className="mb-12">
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-5xl font-black tracking-tight text-[var(--color-on-surface)] mb-2">People</h2>
        <p className="text-[var(--color-on-surface-variant)] font-medium text-lg">
          Managing {employees.length} talented individuals across {departments.length} departments.
        </p>
      </div>
      <div className="flex gap-3">
        {isAdmin && (
          <>
            <BulkEmployeeImport departments={...} />
            <AddEmployeeForm departments={...} />
          </>
        )}
      </div>
    </div>
  </div>
  ```
- Change container: `max-w-6xl` → `max-w-7xl`, padding: `p-8 lg:p-12`
- Pass `departmentsWithCounts` to PeopleList: `<PeopleList employees={employees} departments={departmentsWithCounts} />`
- Update PeopleList props type: `departments: { name: string; memberCount: number }[]`

- [ ] **Step 2: Rewrite PeopleList component**

Complete rewrite of `src/components/people/people-list.tsx`. Key changes:

**State additions:**
```tsx
const [currentPage, setCurrentPage] = useState(1);
const [sortBy, setSortBy] = useState<"recent" | "name">("recent");
const [showFilters, setShowFilters] = useState(false);
const PAGE_SIZE = 12;
```

**Grid layout:** Change from `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` to:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
```

**Featured card** (first employee in paginated list):
```tsx
<div className="col-span-1 md:col-span-2 bg-[var(--color-surface-container-lowest)] rounded-xl p-6 flex flex-col justify-between group relative overflow-hidden transition-all hover:shadow-2xl hover:shadow-[var(--color-primary)]/5">
  <div className="flex gap-6 items-start">
    <div className="relative">
      {/* Square avatar, 96px, rounded-2xl, grayscale hover effect */}
      {employee.profilePhoto ? (
        <img className="w-24 h-24 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition-all duration-500" src={employee.profilePhoto} alt="" />
      ) : (
        <div className={cn("w-24 h-24 rounded-2xl flex items-center justify-center text-white font-bold text-2xl", avatarColors[colorIdx])}>{initials}</div>
      )}
      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-[var(--color-surface-container-lowest)] rounded-full" />
    </div>
    <div>
      <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1 block">{employee.jobTitle}</span>
      <h3 className="text-2xl font-bold text-[var(--color-on-surface)]">{employee.firstName} {employee.lastName}</h3>
      <p className="text-[var(--color-on-surface-variant)] font-medium mb-4">{employee.department?.name}</p>
    </div>
  </div>
  <div className="mt-8 flex gap-3">
    <button className="flex-1 py-3 bg-[var(--color-surface-container)] text-[var(--color-on-surface)] font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[var(--color-primary)] hover:text-white transition-all">
      <Icon name="chat_bubble" size={18} /> Message
    </button>
    <button className="px-4 py-3 bg-[var(--color-surface-container)] text-[var(--color-on-surface)] font-bold rounded-xl text-sm hover:bg-[var(--color-primary)] hover:text-white transition-all">
      <Icon name="mail" size={18} />
    </button>
  </div>
</div>
```

**Regular card:**
```tsx
<div className="bg-[var(--color-surface-container-lowest)] rounded-xl p-6 flex flex-col items-center text-center transition-all hover:shadow-xl hover:shadow-[var(--color-primary)]/5 border border-transparent hover:border-[var(--color-outline-variant)]/20">
  {employee.profilePhoto ? (
    <img className="w-20 h-20 rounded-full object-cover mb-4" src={employee.profilePhoto} alt="" />
  ) : (
    <div className={cn("w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl mb-4", avatarColors[colorIdx])}>{initials}</div>
  )}
  <h3 className="text-lg font-bold text-[var(--color-on-surface)]">{employee.firstName} {employee.lastName}</h3>
  <p className="text-sm font-medium text-[var(--color-on-surface-variant)] mb-3">{employee.jobTitle}</p>
  <StatusLabel status={employee.status} />
  <Link href={`/people/${employee.id}`} className="mt-4 w-full py-2.5 text-sm font-bold text-[var(--color-on-surface)] border border-[var(--color-outline-variant)]/30 hover:border-[var(--color-primary)]/50 rounded-xl transition-colors text-center block">
    View Profile
  </Link>
</div>
```

**Status label component** (inline in the file):
```tsx
function StatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: string; className: string }> = {
    ACTIVE: { label: "Available", icon: "circle", className: "text-green-600 bg-green-50" },
    ONBOARDING: { label: "Onboarding", icon: "rocket_launch", className: "text-[var(--color-primary)] bg-[var(--color-primary-fixed)]/30" },
    PENDING: { label: "Pending Approval", icon: "schedule", className: "text-amber-600 bg-amber-50" },
    OFFBOARDED: { label: "Offboarded", icon: "block", className: "text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container)]" },
  };
  const c = config[status] || config.ACTIVE;
  return (
    <div className={cn("flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider py-2 rounded-lg", c.className)}>
      <Icon name={c.icon} size={14} /> {c.label}
    </div>
  );
}
```

**Team row card** (interspersed in grid, one per department):
```tsx
<div className="col-span-1 md:col-span-3 bg-[var(--color-surface-container-lowest)] rounded-xl p-4 flex items-center justify-between transition-all hover:bg-[var(--color-primary-fixed)]/20">
  <div className="flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-[var(--color-tertiary-fixed)] flex items-center justify-center text-[var(--color-on-tertiary-fixed-variant)]">
      <Icon name="analytics" />
    </div>
    <div>
      <h4 className="font-bold text-[var(--color-on-surface)]">{dept.name}</h4>
      <p className="text-xs text-[var(--color-on-surface-variant)] font-medium">{dept.memberCount} members</p>
    </div>
  </div>
  <div className="flex items-center gap-4">
    <div className="flex -space-x-2">
      {deptEmployees.slice(0, 3).map(emp => (
        emp.profilePhoto ? (
          <img key={emp.id} className="w-8 h-8 rounded-full border-2 border-white object-cover" src={emp.profilePhoto} alt="" />
        ) : (
          <div key={emp.id} className="w-8 h-8 rounded-full border-2 border-white bg-[var(--color-primary-fixed)] flex items-center justify-center text-xs font-bold text-[var(--color-on-primary-fixed-variant)]">{emp.firstName[0]}</div>
        )
      ))}
      {dept.memberCount > 3 && (
        <div className="w-8 h-8 rounded-full border-2 border-white bg-[var(--color-surface-container-highest)] flex items-center justify-center text-xs font-bold text-[var(--color-on-surface)]">+{dept.memberCount - 3}</div>
      )}
    </div>
    <button className="text-[var(--color-primary)] font-bold text-sm px-4">View Team</button>
  </div>
</div>
```

Note: `deptEmployees` is derived by filtering the full employee list by department name for each team row.

**Pagination:**
```tsx
<div className="col-span-full flex flex-col items-center justify-center py-12 gap-6">
  <div className="flex gap-2">
    {pages.map(p => (
      <button
        key={p}
        onClick={() => setCurrentPage(p)}
        className={cn(
          "w-10 h-10 rounded-full font-bold text-sm",
          p === currentPage
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] hover:bg-[var(--color-primary-fixed)] transition-colors"
        )}
      >{p}</button>
    ))}
  </div>
  <p className="text-[var(--color-on-surface-variant)] font-medium text-sm">
    Showing {showing} of {total} employees
  </p>
</div>
```

**Filters button** (replaces department pills):
```tsx
<div className="flex gap-3">
  <button
    onClick={() => setShowFilters(!showFilters)}
    className="px-5 py-2.5 bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] font-semibold rounded-xl flex items-center gap-2 hover:bg-[var(--color-surface-container)] transition-all"
  >
    <Icon name="filter_list" size={18} /> Filters
  </button>
  <button className="px-5 py-2.5 bg-[var(--color-surface-container-highest)] text-[var(--color-on-surface)] font-semibold rounded-xl flex items-center gap-2">
    <Icon name="sort" size={18} /> Recently Joined
  </button>
</div>
```

Remove inline search bar (search is in TopBar).

**Pending employees section:** Preserve the existing amber pending employees alert section (admin-only) at the top of the component. Keep its styling updated to use Luminal Architect tokens but do not change functionality. Include it before the grid in the JSX.

**FAB:** The `AddEmployeeForm` component already manages its own dialog state internally (it renders a trigger button + dialog). The FAB cannot directly open it. Instead, the FAB should be a visual link that scrolls to or highlights the "Add Employee" button in the header. For simplicity, use a no-op FAB that triggers `window.scrollTo({ top: 0, behavior: 'smooth' })`:
```tsx
<FAB icon="person_add" variant="gradient" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
```
Alternatively, if `AddEmployeeForm` can be refactored to accept an `open` prop, wire it properly — but that refactoring is out of scope for this task.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/people/page.tsx src/components/people/people-list.tsx
git commit -m "feat: redesign People Directory to match Stitch — bento grid, status labels, pagination, FAB"
```

---

## Chunk 3: Organization Chart Redesign

### Task 7: Redesign Organization Chart Page

**Files:**
- Modify: `src/app/(dashboard)/org/page.tsx`
- Rewrite: `src/components/org/org-tree.tsx`

**Reference:** Stitch design at `/tmp/stitch-screens/org-chart.html`

- [ ] **Step 1: Rewrite org-tree.tsx with visual tree**

Complete rewrite of `src/components/org/org-tree.tsx`:

Replace the indented `OrgNode` list with a centered visual tree. Key structure:

```tsx
interface OrgTreeProps {
  employees: Employee[];
  departments: { id: string; name: string }[];
}

export function OrgTree({ employees, departments }: OrgTreeProps) {
  // buildTree: same existing logic — Map<managerId, Employee[]>
  const tree = buildTree(employees);
  // findRoots: employees with no manager or whose managerId doesn't match any employee
  const roots = employees.filter(e => !e.managerId || !employees.find(m => m.id === e.managerId));
  const ceo = roots.sort((a, b) => (tree.get(b.id)?.length || 0) - (tree.get(a.id)?.length || 0))[0];
  const directors = tree.get(ceo?.id) || [];

  return (
    <div className="flex flex-col items-center">
      {/* CEO Node */}
      <CEONode employee={ceo} />

      {/* Vertical connector */}
      <div className="org-line-vertical h-16" />

      {/* Horizontal connector spanning all directors */}
      <div className="relative w-full max-w-[1000px] flex justify-center">
        <div className="org-line-horizontal w-full absolute top-0" />
      </div>

      {/* Director level */}
      <div className="flex gap-16 mt-0">
        {directors.map(dir => (
          <DirectorColumn key={dir.id} director={dir} tree={tree} departments={departments} />
        ))}
      </div>
    </div>
  );
}
```

**CEONode sub-component:**
```tsx
function CEONode({ employee }: { employee: Employee }) {
  if (!employee) return null;
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;
  return (
    <div className="w-72 bg-[var(--color-surface-container-lowest)] rounded-2xl p-6 shadow-xl shadow-[var(--color-primary)]/5 border border-[var(--color-outline-variant)]/10 flex flex-col items-center text-center">
      <div className="bg-gradient-to-tr from-[var(--color-primary)] to-[var(--color-primary-container)] p-1 rounded-2xl mb-4">
        {employee.profilePhoto ? (
          <img className="w-20 h-20 rounded-2xl object-cover" src={employee.profilePhoto} alt="" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-[var(--color-primary-fixed)] flex items-center justify-center text-2xl font-bold text-[var(--color-on-primary-fixed-variant)]">{initials}</div>
        )}
      </div>
      <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1">{employee.jobTitle}</span>
      <h3 className="text-lg font-black text-[var(--color-on-surface)]">{employee.firstName} {employee.lastName}</h3>
      <div className="flex gap-2 mt-4 w-full">
        <button className="flex-1 py-2 bg-[var(--color-surface-container-low)] text-[var(--color-primary)] rounded-xl text-sm font-bold">Profile</button>
        <button className="flex-1 py-2 bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)] rounded-xl text-sm font-bold">Contact</button>
      </div>
    </div>
  );
}
```

**DirectorColumn sub-component:**
```tsx
function DirectorColumn({ director, tree, departments }: { director: Employee; tree: Map<string, Employee[]>; departments: { id: string; name: string }[] }) {
  const teams = tree.get(director.id) || [];
  const initials = `${director.firstName[0]}${director.lastName[0]}`;
  // Highlight first director with border-t-4
  return (
    <div className="flex flex-col items-center">
      <div className="org-line-vertical h-8" />
      <div className="w-64 bg-[var(--color-surface-container-lowest)] rounded-xl p-5 border border-[var(--color-outline-variant)]/10 shadow-lg flex flex-col items-center text-center">
        {director.profilePhoto ? (
          <img className="w-16 h-16 rounded-full object-cover mb-3" src={director.profilePhoto} alt="" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary-fixed)] flex items-center justify-center text-lg font-bold text-[var(--color-on-primary-fixed-variant)] mb-3">{initials}</div>
        )}
        <h4 className="font-bold text-[var(--color-on-surface)]">{director.firstName} {director.lastName}</h4>
        <p className="text-xs text-[var(--color-on-surface-variant)] font-medium">{director.jobTitle}</p>
      </div>
      {teams.length > 0 && (
        <>
          <div className="org-line-vertical h-8" />
          <div className="flex flex-col gap-3">
            {teams.slice(0, 5).map(member => (
              <div key={member.id} className="bg-[var(--color-surface-container)] rounded-xl border-l-4 border-[var(--color-primary)] w-56 p-3 flex items-center gap-3">
                <Icon name="group" size={18} className="text-[var(--color-primary)]" />
                <div>
                  <p className="font-bold text-sm text-[var(--color-on-surface)]">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{member.jobTitle}</p>
                </div>
              </div>
            ))}
            {teams.length > 5 && (
              <button className="text-sm font-bold text-[var(--color-primary)] py-2">View {teams.length - 5} more</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

Cap depth at 3: directors + their direct team cards. Deeper nodes get "View team" link.

- [ ] **Step 2: Update org/page.tsx**

Replace `PageHeader` with editorial header:
```tsx
<div className="flex justify-between items-end mb-12">
  <div>
    <h2 className="text-4xl font-extrabold tracking-tight text-[var(--color-on-surface)] mb-2">Organization Structure</h2>
    <p className="text-[var(--color-on-surface-variant)] font-medium text-lg">Visualizing the flow of talent and leadership.</p>
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
```

Replace flat stat cards + department grid with:
- OrgTree component (visual tree)
- Bento stats section (JSX below)
- Keep ManagerAssignment section below as-is (wrap in `<div id="dept-actions">` for FAB scroll target)

Replace container: `max-w-6xl` → full width with `p-10`.

**Bento stats data and JSX** — compute inline in the server component (`org/page.tsx`):
```tsx
{/* Bento Stats */}
<div className="mt-24 grid grid-cols-4 gap-6">
  {/* Org Health — 2-col span */}
  <div className="col-span-2 bg-[var(--color-surface-container-highest)]/30 rounded-2xl p-8 backdrop-blur-sm border border-[var(--color-outline-variant)]/10">
    <div className="flex items-center gap-3 mb-6">
      <h3 className="text-xl font-bold text-[var(--color-on-surface)]">Org Health Overview</h3>
      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Real-time Data</span>
    </div>
    <div className="grid grid-cols-3 gap-6">
      <div>
        <p className="text-3xl font-black text-[var(--color-primary)]">{employees.length}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">Total Employees</p>
      </div>
      <div>
        <p className="text-3xl font-black text-[var(--color-on-surface)]">
          {employees.length > 0 ? Math.round((employees.filter(e => e.status === "ACTIVE").length / employees.length) * 100) : 0}%
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">Retention Rate</p>
      </div>
      <div>
        <p className="text-3xl font-black text-[var(--color-on-surface)]">{departments.length}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">Departments</p>
      </div>
    </div>
  </div>

  {/* Growth card */}
  <div className="bg-[var(--color-primary-container)] rounded-2xl p-8 text-white">
    <Icon name="trending_up" size={32} className="mb-4 opacity-80" />
    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">Projected Growth</p>
    <p className="text-4xl font-black">12%</p>
    <p className="text-sm opacity-70 mt-2">Year over year</p>
  </div>

  {/* Inter-Team card */}
  <div className="bg-white rounded-2xl p-8 border border-[var(--color-outline-variant)]/10">
    <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] mb-4">
      <Icon name="hub" />
    </div>
    <h4 className="font-bold text-[var(--color-on-surface)] mb-1">Inter-Team Connections</h4>
    <p className="text-sm text-[var(--color-on-surface-variant)] mb-4">Cross-department collaboration</p>
    <div className="flex -space-x-2">
      {employees.slice(0, 5).map(emp => (
        emp.profilePhoto ? (
          <img key={emp.id} className="w-8 h-8 rounded-full border-2 border-white object-cover" src={emp.profilePhoto} alt="" />
        ) : (
          <div key={emp.id} className="w-8 h-8 rounded-full border-2 border-white bg-[var(--color-primary-fixed)] flex items-center justify-center text-xs font-bold text-[var(--color-on-primary-fixed-variant)]">{emp.firstName[0]}</div>
        )
      ))}
    </div>
  </div>
</div>
```

**org/departments/page.tsx:** Update container padding to `p-10` and header to editorial style (`text-3xl font-extrabold tracking-tight`). Icon migration is already handled in Task 5.

Add FAB:
```tsx
<FAB icon="add_moderator" variant="solid" onClick={() => document.getElementById('dept-actions')?.scrollIntoView({ behavior: 'smooth' })} />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/org/page.tsx src/components/org/org-tree.tsx
git commit -m "feat: redesign Org Chart with visual tree, gradient connectors, and bento stats"
```

---

## Chunk 4: Calendar Redesign

### Task 8: Redesign Calendar Page

**Files:**
- Modify: `src/app/(dashboard)/calendar/page.tsx`
- Rewrite: `src/components/calendar/calendar-view.tsx`

**Reference:** Stitch design at `/tmp/stitch-screens/calendar.html`

- [ ] **Step 1: Update calendar/page.tsx**

Remove `PageHeader` import and usage. The CalendarView component will handle its own header (month title, navigation, view toggle). Pass events as before. Change container to `px-8 py-8`.

- [ ] **Step 2: Rewrite calendar-view.tsx**

Complete rewrite. Key structure:

**Header section:**
```tsx
<div className="flex justify-between items-end">
  <div className="flex items-center gap-4">
    <button onClick={prevMonth}><Icon name="chevron_left" /></button>
    <h2 className="text-4xl font-black tracking-tight text-[var(--color-on-surface)]">
      {monthName} {year}
    </h2>
    <button onClick={nextMonth}><Icon name="chevron_right" /></button>
    <button onClick={goToday} className="ml-2 px-3 py-1 bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)] rounded-lg text-sm font-bold">Today</button>
  </div>
  <div className="flex items-center bg-[var(--color-surface-container-low)] p-1 rounded-xl">
    <button className="px-4 py-2 rounded-lg bg-[var(--color-surface-container-lowest)] text-[var(--color-primary)] font-bold shadow-sm">Month</button>
    <button className="px-4 py-2 rounded-lg text-[var(--color-on-surface-variant)] font-semibold opacity-50 cursor-not-allowed">Week</button>
    <button className="px-4 py-2 rounded-lg text-[var(--color-on-surface-variant)] font-semibold opacity-50 cursor-not-allowed">Day</button>
  </div>
</div>
```

**Subtitle:** Show milestone count for current week.

**Calendar grid:**

**Important — Monday start:** The current calendar starts on Sunday. Change to Monday start:
- Reorder day labels: `["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]`
- Adjust the first-day-of-month offset: `const adjustedFirstDay = (getFirstDayOfMonth(year, month) + 6) % 7;` (shifts Sunday=0→6, Monday=1→0, etc.)
- Use `adjustedFirstDay` for padding cells before the 1st

```tsx
<div className="bg-[var(--color-surface-container-low)] rounded-[var(--radius-xl)] p-4 mt-8">
  {/* Day labels: Mon-Sun (Monday start) */}
  <div className="grid grid-cols-7 mb-4">
    {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
      <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)] py-2">{d}</div>
    ))}
  </div>
  {/* Grid cells */}
  <div className="grid grid-cols-7 gap-3">
    {cells.map(cell => (
      <DayCell key={cell.key} {...cell} />
    ))}
  </div>
</div>
```

**DayCell component:**
```tsx
function DayCell({ day, isCurrentMonth, isToday, events }: DayCellProps) {
  const maxChips = 2;
  const visibleEvents = events.slice(0, maxChips);
  const overflow = events.length - maxChips;

  return (
    <div className={cn(
      "min-h-[120px] rounded-2xl p-4 flex flex-col gap-2",
      !isCurrentMonth && "opacity-40",
      isToday
        ? "bg-[var(--color-primary-fixed)] border-2 border-[var(--color-primary)]/20"
        : "bg-[var(--color-surface-container-lowest)]"
    )}>
      <div className="flex justify-between items-start">
        <span className={cn("text-sm font-bold", isToday ? "font-black text-[var(--color-primary)]" : "text-[var(--color-on-surface)]")}>{day}</span>
        {isToday && <span className="bg-[var(--color-primary)] text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase">Today</span>}
      </div>
      {visibleEvents.map((evt, i) => (
        <EventChip key={evt.id} event={evt} isToday={isToday} index={i} />
      ))}
      {overflow > 0 && <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">+{overflow} more</span>}
    </div>
  );
}
```

**EventChip colors** (by type):
```tsx
const chipStyles: Record<string, string> = {
  birthday: "bg-[var(--color-tertiary-container)]/10 text-[var(--color-tertiary)]",
  anniversary: "bg-[var(--color-tertiary-fixed)] text-[var(--color-on-tertiary-fixed-variant)]",
  interview: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  benefits: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
};
// Holiday types (holiday-jewish, holiday-muslim, holiday-christian, holiday-american) all use:
// "bg-[var(--color-error-container)]/20 text-[var(--color-on-error-container)]"
// Note: For interviews with a googleMeetLink, the chip should be clickable — wrap in <a href={evt.googleMeetLink} target="_blank">. This preserves the existing meet link functionality.
```

Today's events get special treatment: first chip `bg-[var(--color-primary)] text-white`, second `bg-white/50 text-[var(--color-primary)]`.

**Contextual Insights section** (below calendar):
```tsx
<div className="grid grid-cols-3 gap-6 mt-8">
  {/* Upcoming Highlights — glass panel */}
  <div className="glass rounded-[var(--radius-xl)] p-6 space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
        <Icon name="auto_awesome" />
      </div>
      <h3 className="font-bold text-lg">Upcoming Highlights</h3>
    </div>
    {/* Next 2-3 events with mini date icons */}
    {/* upcomingEvents: derive from events — filter to dates >= today, sort by date, take first 3 */}
    {/* const upcomingEvents = events.filter(e => new Date(e.date) >= today).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, 3); */}
    {upcomingEvents.map(evt => (
      <div key={evt.id} className="flex items-center gap-4">
        <div className="w-12 h-14 rounded-xl bg-[var(--color-primary-fixed)] flex flex-col items-center justify-center overflow-hidden">
          <div className="w-full bg-[var(--color-primary)] text-white text-[8px] font-bold text-center py-0.5">{new Date(evt.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</div>
          <span className="text-lg font-black text-[var(--color-on-primary-fixed-variant)]">{new Date(evt.date).getDate()}</span>
        </div>
        <div>
          <p className="font-bold text-sm text-[var(--color-on-surface)]">{evt.title}</p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">{evt.type}</p>
        </div>
      </div>
    ))}
  </div>

  {/* Promo card — dark, 2-col span */}
  <div className="col-span-2 bg-[var(--color-inverse-surface)] rounded-[var(--radius-xl)] p-8 relative overflow-hidden flex items-center">
    <div className="relative z-10 space-y-4 max-w-md">
      <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary-fixed-dim)] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Pro Tip</span>
      <h3 className="text-2xl font-black text-white leading-tight">Sync your calendar with Google or Outlook.</h3>
      <p className="text-[var(--color-surface-variant)]/70 text-sm">Keep your professional and personal life in perfect harmony.</p>
      <button className="bg-[var(--color-surface)] text-[var(--color-on-surface)] px-6 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform">Enable Sync Now</button>
    </div>
    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[var(--color-primary)]/30 to-transparent" />
    <Icon name="calendar_month" size={200} className="absolute -right-10 -bottom-10 text-white/5 rotate-12" />
  </div>
</div>
```

Remove: event type legend, click-to-select detail panel, 4 summary cards.

Add FAB:
```tsx
<FAB icon="event" variant="solid" />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/calendar/page.tsx src/components/calendar/calendar-view.tsx
git commit -m "feat: redesign Calendar with inline event chips, glass insights, and dark promo card"
```

---

## Chunk 5: Final Verification

### Task 9: Full Build and Cleanup

- [ ] **Step 1: Verify no lucide-react imports remain**

```bash
grep -r "lucide-react" src/ --include="*.tsx" --include="*.ts"
```
Expected: No results.

- [ ] **Step 2: Verify lucide-react is not in package.json**

```bash
grep "lucide-react" package.json
```
Expected: No results.

- [ ] **Step 3: Full build**

```bash
npm run build
```
Expected: Build succeeds with zero errors.

- [ ] **Step 4: Visual check — verify the dev server renders correctly**

```bash
npm run dev
```

Check these routes:
- `/people` — bento grid, featured card, status labels, pagination, FAB
- `/org` — visual tree with connectors, bento stats, FAB
- `/calendar` — large grid cells, event chips, insights panel, promo card, FAB
- `/` — feed page still works (icons migrated)
- `/settings` — settings page still works

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup after Stitch alignment redesign"
```
