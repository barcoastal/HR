# Page Redesigns — Stitch Alignment

**Date**: 2026-03-21
**Status**: Approved
**Project**: CALATRAVA — Coastal Debt HR Platform
**Depends on**: Luminal Architect design system (deployed 2026-03-20)
**Supersedes**: The Luminal Architect spec's "Icon library: Lucide React" stays statement — this spec migrates to Material Symbols Outlined

## Overview

Redesign three pages — People Directory, Organization Chart, and Company Calendar — to match the Stitch reference designs created in Google Stitch. This includes layout overhauls, new UI patterns (bento grids, visual org tree, inline event chips), icon library migration from Lucide React to Material Symbols Outlined, and targeted design token expansion.

### Goals

1. **Visual alignment** — Match the Stitch reference layouts for these 3 pages
2. **Icon migration** — Replace Lucide React with Material Symbols Outlined app-wide
3. **Token expansion** — Add only the color tokens these pages consume
4. **New UI patterns** — FABs, bento grids, status labels, event chips, org tree connectors

### Non-Goals

- Adding Week/Day calendar views (Month/Week/Day toggle renders but only Month functions)
- Real-time presence data (Available/In Meeting statuses map from existing employee status field)
- Calendar sync functionality (promo card is decorative)
- Changing any backend logic, APIs, or database schema

### Constraints

- Keep Lucide React removed cleanly — no mixed icon libraries after migration
- Only add design tokens these 3 pages actually use
- FABs added alongside existing PageHeader action buttons (both entry points)
- Org tree visualization caps at 3 levels; deeper nodes collapse behind "View team"
- Manager Assignment section on org page stays as-is (admin tooling, not in Stitch)

---

## Shared Foundation

### Icon Migration: Lucide React → Material Symbols Outlined

**Font loading**: Add Material Symbols Outlined via Google Fonts link in `layout.tsx` `<head>`.

**Icon component**: Create `src/components/ui/icon.tsx`:
```tsx
interface IconProps {
  name: string
  fill?: boolean
  size?: number
  className?: string
}

function Icon({ name, fill = false, size = 24, className }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`
      }}
    >
      {name}
    </span>
  )
}
```

**Migration scope**: Every file importing from `lucide-react`. Replace each `<LucideIcon />` with `<Icon name="material_equivalent" />`. Remove `lucide-react` from package.json after all replacements.

**Migration scope detail**: 88 files import from `lucide-react` using ~90 unique icons. See Appendix A for the complete icon mapping table.

**Icon component import**: The component uses `cn()` from `@/lib/utils`.

### New Design Tokens

Added to `globals.css` `@theme` block — tokens these 3 pages consume plus one new radius token:

| Token | Value | Used by |
|-------|-------|---------|
| `--color-tertiary` | `#00628b` | Calendar birthday chips |
| `--color-tertiary-container` | `#007caf` | Calendar event accent |
| `--color-tertiary-fixed` | `#c7e7ff` | Anniversary chips, team card bg |
| `--color-on-tertiary-fixed-variant` | `#004c6c` | Text on tertiary-fixed |
| `--color-error-container` | `#ffdad6` | Holiday chips |
| `--color-on-error-container` | `#93000a` | Text on error-container |
| `--color-inverse-surface` | `#2f2f3c` | Calendar promo card bg |
| `--color-inverse-primary` | `#c9bfff` | Text on inverse-surface |
| `--color-outline` | `#797587` | Calendar day labels |
| `--color-surface-container-high` | `#e9e6f8` | Org chart hover states |
| `--color-primary-fixed-dim` | `#c9bfff` | Promo card accent |
| `--radius-xl` | `2rem` (32px) | Calendar container, insights panels, promo card |

### FAB Component

Shared `src/components/ui/fab.tsx`:
- Fixed positioning: `fixed bottom-8 right-8 z-50`
- Gradient variant (People): `gradient-primary rounded-2xl w-14 h-14`
- Solid variant (Org, Calendar): `bg-primary rounded-full w-16 h-16`
- Shadow: `shadow-2xl shadow-primary/40`
- Hover: `hover:scale-110 active:scale-95 transition-all`
- Props: `icon: string`, `variant: 'gradient' | 'solid'`, `onClick`

---

## Page 1: People Directory

**Route**: `/people` → `src/app/(dashboard)/people/page.tsx`
**Main component**: `src/components/people/people-list.tsx`

### Layout Changes

**Header**: Replace PageHeader usage with editorial header.
- Title: `text-5xl font-black tracking-tight` ("People")
- Subtitle: `text-lg font-medium text-on-surface-variant` ("Managing {count} talented individuals across {dept_count} departments.")
- Right side: "Filters" button + "Recently Joined" sort button (both `bg-surface-container-highest rounded-xl`)
- PageHeader action buttons (Add Employee, Bulk Import) stay in the header area

**Search**: Remove inline search bar from the page. Search moves to the TopBar (global search). The existing TopBar search input handles people search.

**Department filter**: Remove horizontal department pill buttons. Filtering handled by the "Filters" button which opens a dropdown/popover with department checkboxes.

**Grid**: Change from uniform 3-col to bento 4-col (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`).

### Card Types

**Featured card** (first employee in list):
- Spans 2 columns: `col-span-1 md:col-span-2`
- Horizontal layout: square avatar (96px, `rounded-2xl`, grayscale by default, color on hover) + info
- Job title as label above name: `text-[10px] font-bold text-primary uppercase tracking-widest`
- Name: `text-2xl font-bold`
- Department: `text-on-surface-variant font-medium`
- Skill tags: `bg-primary-fixed text-on-primary-fixed-variant rounded-full text-[11px] font-bold uppercase` (uses employee hobbies or bio keywords — optional, can be static)
- Action buttons: "Message" (flex-1) + Mail icon button, both `bg-surface-container rounded-xl`
- Online indicator: green dot on avatar corner
- Hover: more_vert button appears top-right, `hover:shadow-2xl hover:shadow-primary/5`

**Regular card** (all other employees):
- Single column, center-aligned
- Circular avatar (80px, `rounded-full`)
- Name: `text-lg font-bold`
- Job title: `text-sm font-medium text-on-surface-variant`
- Status label at bottom (full-width): icon + text, color-coded by status
- "View Profile" button: ghost border `border-outline-variant/30 hover:border-primary/50`
- Hover: `hover:shadow-xl hover:shadow-primary/5 border border-transparent hover:border-outline-variant/20`

**Team row card** (one per department, interspersed in grid):
- Spans 3 columns: `col-span-1 md:col-span-3`
- Horizontal layout: icon in `rounded-xl bg-tertiary-fixed` + team name + member count + online count
- Avatar stack on right: up to 3 member photos + "+N" pill
- "View Team" link: `text-primary font-bold`

### Status Label Mapping

| Employee Status | Label | Icon | Colors |
|----------------|-------|------|--------|
| ACTIVE | Available | `circle` | text: green-600, bg: green-50 |
| ONBOARDING | Onboarding | `rocket_launch` | text: primary, bg: primary-fixed/30 |
| PENDING | Pending Approval | `schedule` | text: amber-600, bg: amber-50 |
| OFFBOARDED | Offboarded | `block` | text: on-surface-variant, bg: surface-container |

### Pagination

Replace current load-all pattern with circular page buttons:
- Active: `w-10 h-10 rounded-full bg-primary text-white font-bold`
- Inactive: `w-10 h-10 rounded-full bg-surface-container-highest text-on-surface hover:bg-primary-fixed`
- Ellipsis for large ranges
- "Showing X of Y employees" text below
- Page size: 12 employees per page

### FAB

- Icon: `person_add`
- Variant: gradient
- onClick: opens existing add-employee dialog

### Pending Employees Section

Keep the amber pending employees alert section at top (for admins only), styled to match Luminal Architect tokens but functionally unchanged.

---

## Page 2: Organization Chart

**Route**: `/org` → `src/app/(dashboard)/org/page.tsx`
**Main component**: `src/components/org/org-tree.tsx` (major rewrite)

### Layout Changes

**Header**: Editorial treatment.
- Title: `text-4xl font-extrabold tracking-tight` ("Organization Structure")
- Subtitle: `text-lg font-medium text-on-surface-variant` ("Visualizing the flow of talent and leadership.")
- Right side: "All Departments" filter button (`bg-surface-container-highest`) + "Export Chart" primary button (`bg-primary text-white shadow-lg shadow-primary/10`)

### Visual Org Tree

Replace the indented `OrgNode` list with a centered visual tree:

**CEO Node (root)**:
- Centered at top, `w-72`
- Avatar: `w-20 h-20 rounded-2xl` with gradient border frame (`bg-gradient-to-tr from-primary to-primary-container p-1`)
- Name: `text-lg font-black`
- Title: `text-primary font-bold text-xs uppercase tracking-widest`
- Two buttons: "Profile" (`bg-surface-container-low text-primary`) + "Contact" (`bg-primary-fixed text-on-primary-fixed-variant`)
- Shadow: `shadow-xl shadow-primary/5`, ghost border `border-outline-variant/10`

**Connector lines**:
- Vertical: `width: 2px; background: linear-gradient(to bottom, #7459f7 0%, #e3e0f2 100%)`
- Horizontal: `height: 2px; background: #e3e0f2`
- CSS classes: `.org-line-vertical` and `.org-line-horizontal` in globals.css

**Director Nodes (depth 1)**:
- Flex row centered below horizontal connector
- Each: `w-64`, circular avatar (`w-16 h-16 rounded-full`), name + title
- Ghost border, `shadow-lg`
- One highlighted director gets `border-t-4 border-primary` (the CTO or most senior)

**Team Cards (depth 2+)**:
- Below each director via vertical connector
- `bg-surface-container rounded-xl border-l-4 border-primary w-56`
- Material icon + team/department name + member count
- Stacked vertically in a column

**Depth cap**: Tree renders max 3 levels. Nodes with children beyond depth 2 show a "View team" link that navigates to a filtered view or expands inline.

### Bento Stats Section

Below the tree, with `mt-24` spacing. Grid: `grid-cols-4 gap-6`.

**Org Health card** (2-col span):
- `bg-surface-container-highest/30 rounded-2xl p-8 backdrop-blur-sm border-outline-variant/10`
- Title: "Org Health Overview" + "Real-time Data" badge (`bg-primary/10 text-primary rounded-full`)
- 3-col inner grid: Total Employees (primary color), Retention Rate, Departments
- Values: `text-3xl font-black`, labels: `text-[10px] font-bold uppercase`

**Growth card** (1-col):
- `bg-primary-container text-white rounded-2xl p-8`
- Trending_up icon, "Projected Growth" title, large percentage value
- Data: calculated from headcount change over last year, or static if insufficient data

**Inter-Team card** (1-col):
- `bg-white rounded-2xl p-8 border-outline-variant/10`
- Hub icon in primary, "Inter-Team Connections" title
- Avatar stack of employees from different departments

### Manager Assignment

Keep existing manager-assignment.tsx section unchanged. Appears below the bento stats as a collapsible admin section.

### FAB

- Icon: `add_moderator` (filled)
- Variant: solid
- onClick: opens department creation dialog (existing DepartmentActions)

---

## Page 3: Company Calendar

**Route**: `/calendar` → `src/app/(dashboard)/calendar/page.tsx`
**Main component**: `src/components/calendar/calendar-view.tsx` (major rewrite)

### Layout Changes

**Header**: Editorial month display.
- Title: `text-4xl font-black tracking-tight` (month name + year, e.g., "March 2026")
- Subtitle: `text-on-surface-variant font-medium` ("{N} important milestones this week")
- Month navigation: left/right arrow buttons adjacent to the title (not in separate nav bar)

**View toggle**: Pill group on right side of header.
- Container: `bg-surface-container-low p-1 rounded-xl`
- Active tab: `bg-surface-container-lowest text-primary font-bold shadow-sm rounded-lg px-4 py-2`
- Inactive tabs: `text-on-surface-variant font-semibold hover:bg-surface-container-highest rounded-lg px-4 py-2`
- Only Month is functional. Week/Day are disabled with `opacity-50 cursor-not-allowed` or just visually present but non-functional.

### Calendar Grid

**Container**: `bg-surface-container-low rounded-[var(--radius-xl)] p-4`

**Day labels row**: `text-[10px] font-black uppercase tracking-widest text-outline` (Mon–Sun, starting Monday per Stitch)

**Grid**: `grid-cols-7 gap-3`

**Day cells**:
- Base: `min-h-[120px] bg-surface-container-lowest rounded-2xl p-4`
- Day number: `text-sm font-bold text-on-surface`
- Previous/next month days: same cell but `opacity-40`
- Today: `bg-primary-fixed border-2 border-primary/20`, day number in `font-black text-primary`, "Today" badge (`bg-primary text-white text-[8px] rounded-full px-1.5 py-0.5 font-bold uppercase`)

**Event chips** (inside cells):
- Max 2 visible per cell, "+N more" if overflow
- Truncated text with `truncate`
- Rounded-lg, `text-[10px] font-bold px-2 py-1`
- Today's events: first chip gets `bg-primary text-white`, second gets `bg-white/50 text-primary`
- Color mapping by event type (see table below)

### Event Chip Colors

| Type | Background | Text | Icon |
|------|-----------|------|------|
| Birthday | `tertiary-container/10` | `tertiary` | `cake` |
| Anniversary | `tertiary-fixed` | `on-tertiary-fixed-variant` | `verified` |
| Interview | `primary/10` | `primary` | `videocam` |
| Holiday | `error-container/20` | `error` | `celebration` |
| Benefits | `primary-fixed` | `on-primary-fixed-variant` | `health_and_safety` |

### Removed Components

- **Event type legend bar**: Removed. Events are self-describing via chips.
- **Click-to-select detail panel**: Removed. Events visible inline. Future: click a day to open a popover.
- **4 summary cards** (Birthdays/Anniversaries/Benefits/Holidays this month): Replaced by Upcoming Highlights panel.

### Contextual Insights Section

Grid below calendar: `grid-cols-3 gap-6`

**Upcoming Highlights panel** (1-col):
- Glassmorphism: `glass rounded-[var(--radius-xl)] p-6`
- Header: auto_awesome icon in `bg-primary/10 rounded-full` + "Upcoming Highlights" bold title
- Items: mini date icon (month header strip + large day number) + event name + detail text
- Shows next 2-3 upcoming events from current date

**Promo card** (2-col span):
- `bg-inverse-surface rounded-[var(--radius-xl)] p-8 relative overflow-hidden`
- "Pro Tip" badge: `bg-primary/20 text-primary-fixed-dim rounded-full text-[10px] uppercase tracking-widest`
- Headline: `text-2xl font-black text-white`
- Body: `text-surface-variant/70 text-sm`
- CTA button: `bg-surface text-on-surface rounded-xl font-bold hover:scale-105`
- Decorative: gradient overlay on right (`bg-gradient-to-l from-primary/30`), oversized calendar icon watermark at 5% opacity
- Static/decorative content — no functional calendar sync

### FAB

- Icon: `event`
- Variant: solid
- onClick: no-op for now (future: quick event creation)

---

## Affected Files

### Shared (Foundation)
- `src/app/globals.css` — Add new tokens, new radius token, `.org-line-vertical` / `.org-line-horizontal` classes
- `src/app/layout.tsx` — Add Material Symbols font link
- `src/components/ui/icon.tsx` — NEW: Icon wrapper component
- `src/components/ui/fab.tsx` — NEW: FAB component
- `package.json` — Remove `lucide-react`

### Icon Migration (88 files)

All files importing from `lucide-react` — grouped by area:

**Layout (3 files):** sidebar.tsx, top-bar.tsx, mobile-nav.tsx
**UI (1 file):** dialog.tsx
**Auth (1 file):** login/page.tsx
**Dashboard pages (12 files):** analytics/page.tsx, clubs/page.tsx, cv/page.tsx, my-profile/page.tsx, offboarding/page.tsx, onboarding/page.tsx, org/page.tsx, org/departments/page.tsx, people/[id]/page.tsx, pre-onboarding/page.tsx, reviews/page.tsx, time-off/page.tsx, welcome/page.tsx
**Public pages (1 file):** sign/[token]/page.tsx
**People components (6 files):** people-list.tsx, add-employee-form.tsx, bulk-employee-import.tsx, delete-employee-button.tsx, edit-employee-dialog.tsx, employee-documents-section.tsx, hr-notes-section.tsx
**Org components (3 files):** org-tree.tsx, manager-assignment.tsx, department-actions.tsx
**Calendar (1 file):** calendar-view.tsx
**CV/Recruitment (10 files):** add-candidate-form.tsx, add-candidate-to-position.tsx, add-position-form.tsx, candidate-database.tsx, candidate-detail-dialog.tsx, candidate-pipeline.tsx, csv-import.tsx, cv-tabs.tsx, platform-sync-panel.tsx, schedule-interview-dialog.tsx, search-candidates.tsx
**Feed (3 files):** post-card.tsx, post-composer.tsx, comment-section.tsx
**Onboarding (4 files):** onboarding-timeline.tsx, onboarding-preview.tsx, onboarding-task-manager.tsx, my-onboarding-tasks.tsx
**Reviews (5 files):** add-review-dialog.tsx, create-cycle-dialog.tsx, cycle-actions.tsx, generate-reviews-dialog.tsx, submit-review-dialog.tsx, view-review-dialog.tsx
**Settings (12 files):** checklist-manager.tsx, cleanup-demo-button.tsx, company-info.tsx, department-manager.tsx, email-template-manager.tsx, job-title-manager.tsx, native-integrations.tsx, offboarding-setup.tsx, onboarding-setup.tsx, permissions-manager.tsx, platform-connect-dialog.tsx, platform-integration-manager.tsx, pto-policy-manager.tsx, pulse-survey-manager.tsx, recruiter-manager.tsx, user-management.tsx
**Time-off (5 files):** burnout-alerts.tsx, request-list.tsx, request-time-off-dialog.tsx, team-calendar.tsx, whos-out-widget.tsx
**Documents (1 file):** document-signing-manager.tsx
**Signing (1 file):** signing-page.tsx
**My Profile (4 files):** edit-about-dialog.tsx, edit-emergency-contact-dialog.tsx, edit-personal-info-dialog.tsx, profile-photo-upload.tsx
**Other (4 files):** ai-analytics-bar.tsx, club-card.tsx, create-club-dialog.tsx, pulse-popup.tsx, feedback-form.tsx, feedback-list.tsx

### Page Redesigns (layout + visual overhauls)

**People Directory:**
- `src/app/(dashboard)/people/page.tsx` — Update header, add pagination logic
- `src/components/people/people-list.tsx` — Major rewrite: bento grid, card types, status labels, team rows, pagination, FAB

**Organization Chart:**
- `src/app/(dashboard)/org/page.tsx` — Update header, add bento stats section
- `src/app/(dashboard)/org/departments/page.tsx` — Icon updates, visual consistency with new org styling
- `src/components/org/org-tree.tsx` — Major rewrite: visual tree with connectors, CEO spotlight, director nodes, team cards
- `src/components/org/department-actions.tsx` — Icon updates only
- `src/components/org/manager-assignment.tsx` — Icon updates only (layout stays as-is)

**Calendar:**
- `src/app/(dashboard)/calendar/page.tsx` — Update header
- `src/components/calendar/calendar-view.tsx` — Major rewrite: grid cells, event chips, view toggle, insights panel, promo card, FAB

---

## What Stays

- **All backend logic**: Server actions, data fetching, Prisma queries unchanged
- **Component architecture**: CVA + Tailwind + cn() helper
- **Animation system**: Framer Motion page transitions
- **Auth/routing**: All unchanged
- **Manager Assignment**: Layout stays as-is on org page (icons migrated)
- **Add Employee / Bulk Import dialogs**: Functionality unchanged, icons updated
- **Pending employees section**: Stays on people page (admin only)
- **Holiday calculation**: holidays.ts unchanged
- **Event type system**: Same CalendarEvent types, just rendered as chips instead of dots

---

## Appendix A: Lucide → Material Symbols Icon Mapping

### Direct Name Matches
| Lucide | Material Symbols |
|--------|-----------------|
| `Search` | `search` |
| `Settings` | `settings` |
| `Plus` | `add` |
| `Check` | `check` |
| `Upload` | `upload` |
| `Download` | `download` |
| `Send` | `send` |
| `Save` | `save` |
| `Copy` | `content_copy` |
| `Info` | `info` |
| `Image` | `image` |
| `Globe` | `language` |
| `Play` | `play_arrow` |
| `Square` | `stop` |
| `Eye` | `visibility` |
| `EyeOff` | `visibility_off` |
| `Lock` | `lock` |
| `Pin` | `push_pin` |
| `Star` | `star` |
| `Code` | `code` |

### Navigation & Chevrons
| Lucide | Material Symbols |
|--------|-----------------|
| `ChevronDown` | `expand_more` |
| `ChevronUp` | `expand_less` |
| `ChevronLeft` | `chevron_left` |
| `ChevronRight` | `chevron_right` |
| `ArrowRight` | `arrow_forward` |
| `ArrowUpRight` | `open_in_new` |
| `LogOut` | `logout` |
| `LogIn` | `login` |
| `Menu` | `menu` |

### People & Users
| Lucide | Material Symbols |
|--------|-----------------|
| `Users` | `group` |
| `Users2` | `groups` |
| `UsersRound` | `groups` |
| `User` | `person` |
| `UserPlus` | `person_add` |
| `UserMinus` | `person_remove` |
| `UserCheck` | `how_to_reg` |
| `UserCircle` | `account_circle` |

### Actions & Status
| Lucide | Material Symbols |
|--------|-----------------|
| `X` / `XIcon` | `close` |
| `Pencil` | `edit` |
| `Trash2` | `delete` |
| `Loader2` | `progress_activity` (animated via CSS) |
| `AlertCircle` | `error` |
| `AlertTriangle` | `warning` |
| `CheckCircle2` | `check_circle` |
| `XCircle` | `cancel` |
| `Ban` | `block` |
| `RotateCcw` | `undo` |
| `RefreshCw` | `refresh` |
| `Filter` | `filter_list` |

### Content & Files
| Lucide | Material Symbols |
|--------|-----------------|
| `FileText` | `description` |
| `FileSpreadsheet` | `table_chart` |
| `FileCheck` | `task` |
| `FileSignature` | `draw` |
| `Inbox` | `inbox` |
| `Paperclip` | `attach_file` |
| `Link2` | `link` |
| `Unlink` | `link_off` |
| `ClipboardCheck` | `assignment_turned_in` |
| `ClipboardList` | `assignment` |

### Business & Organization
| Lucide | Material Symbols |
|--------|-----------------|
| `Building` | `apartment` |
| `Building2` | `business` |
| `Briefcase` | `work` |
| `Layers` | `layers` |
| `Target` | `target` |
| `Archive` | `archive` |
| `Shield` | `shield` |
| `ShieldCheck` | `verified_user` |

### Communication
| Lucide | Material Symbols |
|--------|-----------------|
| `Bell` | `notifications` |
| `Mail` | `mail` |
| `Phone` | `phone` |
| `MessageCircle` | `chat_bubble` |
| `Reply` | `reply` |
| `Megaphone` | `campaign` |
| `Video` | `videocam` |
| `Linkedin` | Use `<Icon name="link" />` or keep as SVG |
| `ExternalLink` | `open_in_new` |

### Calendar & Time
| Lucide | Material Symbols |
|--------|-----------------|
| `Calendar` | `calendar_today` |
| `CalendarDays` | `calendar_month` |
| `Clock` | `schedule` |

### Misc
| Lucide | Material Symbols |
|--------|-----------------|
| `Sparkles` | `auto_awesome` |
| `Zap` | `bolt` |
| `Activity` | `monitoring` |
| `BarChart3` | `bar_chart` |
| `Camera` | `photo_camera` |
| `MapPin` | `location_on` |
| `Palmtree` | `beach_access` |
| `Cake` | `cake` |
| `PartyPopper` | `celebration` |
| `Heart` | `favorite` |
| `Smile` | `mood` |
| `Newspaper` | `newspaper` |
| `Cable` | `cable` |
| `PenTool` / `PenLine` | `edit_note` |
| `MousePointer2` | `mouse` |
| `Newspaper` | `feed` |
| `Circle` | `circle` |

### Notes
- `Loader2` → `progress_activity`: Add CSS animation `@keyframes spin { to { transform: rotate(360deg) } }` and apply `animate-spin` class
- `Linkedin` has no Material Symbol equivalent. Either keep as inline SVG or use a generic `link` icon
- Some icons may need `fill` prop for filled variants (e.g., sidebar active icons use `font-variation-settings: 'FILL' 1`)
