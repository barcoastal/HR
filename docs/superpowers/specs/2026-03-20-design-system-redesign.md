# HR Platform Design System & Visual Redesign — "Luminal Architect"

**Date**: 2026-03-21
**Status**: Approved
**Project**: CALATRAVA — Coastal Debt HR Platform

## Overview

Redesign the HR platform using the **Luminal Architect** design system — a high-end editorial approach that treats the interface as a physical environment with atmospheric depth, tonal layering, and intentional asymmetry. Replace the current dark glassmorphism aesthetic with a lavender-tinted indigo palette, "no-line" boundaries, and premium gradient CTAs.

### Goals

1. **Visual cohesion** — Apply the Luminal Architect system consistently across all pages
2. **Premium feel** — Move beyond "enterprise template" to editorial, magazine-style UI
3. **Maintainable tokens** — Single source of truth for the tonal spectrum as CSS custom properties
4. **Smooth migration** — Components already consume CSS variables via Tailwind, so token changes cascade

### Non-Goals

- Building a documented component library (tokens + rules only — components stay custom)
- Adding new features or changing functionality
- Changing the component architecture (CVA + Tailwind stays)
- Changing the layout structure (sidebar + topbar + mobile nav stays)

---

## Design Philosophy

### The "No-Line" Rule
**No 1px solid borders to define sections.** Layout boundaries are established through background color shifts (tonal transitions) or ghost borders at 15% opacity. 100% opaque borders are forbidden.

### Tonal Layering (Elevation)
Hierarchy through surface color stacking, not drop shadows. A white card on a lavender background creates "lift" naturally.

### Glass & Gradient
Floating elements (modals, dropdowns) use glassmorphism. Primary CTAs use a subtle gradient. This adds depth that flat colors cannot.

### Editorial Typography
Inter used as an editorial statement — tight tracking on display text, generous spacing between sections, primary color on key navigational anchors.

---

## Design Tokens

### Color Palette — The Tonal Spectrum

#### Surfaces (layered sheets)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-surface` | `#fcf8ff` | Base layer — main content background |
| `--color-surface-container` | `#efecfd` | Content zones, grouped areas |
| `--color-surface-container-low` | `#f5f2ff` | Sidebar, secondary panels |
| `--color-surface-container-lowest` | `#ffffff` | Interactive cards — "pop" against containers |
| `--color-surface-container-highest` | `#e3e0f2` | Active states, high-priority areas |
| `--color-surface-variant` | `#e3e0f2` | Glassmorphism base (used at 70% opacity + blur) |

#### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--color-on-surface` | `#1a1a27` | Primary text, headings |
| `--color-on-surface-variant` | `#484555` | Body text, descriptions — soft contrast |
| `--color-text-muted` | `#78758a` | Placeholder, helper text, timestamps |
| `--color-on-primary` | `#ffffff` | Text on primary-colored backgrounds |

#### Primary (Indigo)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `#5b3cdd` | Primary actions, links, key anchors |
| `--color-primary-container` | `#7459f7` | Gradient end for CTAs |
| `--color-primary-fixed` | `#e5deff` | Active nav states, selected backgrounds |
| `--color-on-primary-fixed-variant` | `#441cc8` | Text on primary-fixed backgrounds |

#### Outline

| Token | Value | Usage |
|-------|-------|-------|
| `--color-outline-variant` | `#c9c4d8` | Ghost borders (use at 15% opacity only) |

#### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#10B981` | Success states, completed tasks |
| `--color-warning` | `#F59E0B` | Warnings, pending states |
| `--color-danger` | `#EF4444` | Errors, destructive actions |
| `--color-info` | `#7459f7` | Informational (uses primary-container) |

### Typography — Editorial Authority

**Font**: Inter only (no Aeonik — Inter used as editorial statement)

| Role | Size | Weight | Tracking | Color | Usage |
|------|------|--------|----------|-------|-------|
| Display lg | 2.25rem (36px) | 700 | -0.02em | `on-surface` | Dashboard hero stats |
| Display md | 1.875rem (30px) | 700 | -0.02em | `on-surface` | High-impact data points |
| Headline md | 1.5rem (24px) | 600 | normal | `on-surface` | Page titles |
| Headline sm | 1.25rem (20px) | 600 | normal | `on-surface` | Section headers |
| Title lg | 1.125rem (18px) | 600 | normal | `primary` | Key navigational anchors |
| Title md | 1rem (16px) | 500 | normal | `on-surface` | Card titles |
| Body lg | 1rem (16px) | 400 | normal | `on-surface-variant` | Default body |
| Body md | 0.875rem (14px) | 400 | normal | `on-surface-variant` | Table cells, descriptions |
| Label lg | 0.875rem (14px) | 500 | normal | `on-surface` | Form labels, buttons |
| Label sm | 0.75rem (12px) | 500 | 0.01em | `text-muted` | Captions, timestamps |

### Spacing

Uses Tailwind's default spacing scale. Key editorial patterns:
- Between major sections: `gap-20` (5rem) — generous "breathe" space
- Section header top padding: `pt-12` or `pt-16`
- Card padding: `p-5` (20px) or `p-6` (24px)
- Element gap: `gap-3` (12px) or `gap-4` (16px)

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-md` | `0.75rem` (12px) | UI controls: buttons, inputs, badges |
| `--radius-lg` | `1rem` (16px) | Layout containers: cards, panels |
| `--radius-full` | `9999px` | Avatars, pills |

**Strict rule:** Only `md` for controls, `lg` for containers. No mixing.

### Shadows — Tinted Ambient

Shadows are secondary to tonal layering. When needed, they must be tinted with `on-surface`:

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-ambient` | `0 20px 40px rgba(26, 26, 39, 0.06)` | Floating elements (FABs, popovers) |
| `--shadow-glass` | `0 8px 32px rgba(26, 26, 39, 0.08)` | Glassmorphism panels |
| `--shadow-focus` | `0 0 0 3px rgba(91, 60, 221, 0.2)` | Focus rings (primary-tinted) |

### Glassmorphism (for floating elements only)

```css
.glass {
  background: rgba(227, 224, 242, 0.70); /* surface-variant at 70% */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

### Gradient (for primary CTAs only)

```css
.gradient-primary {
  background: linear-gradient(135deg, #5b3cdd 0%, #7459f7 100%);
}
```

---

## Component Rules

### Buttons
- **Primary:** Gradient fill (primary→primary_container), `radius-md`, white text. No shadow at rest; ambient shadow on hover.
- **Secondary:** Transparent bg + ghost border (`outline-variant` at 15% opacity). Text: `primary`.
- **Tertiary/Ghost:** No bg or border. Text: `on-surface-variant`.
- **Destructive:** Solid `danger` bg, white text.

### Cards & Lists
- Cards: `surface-container-lowest` (white) on `surface` background. `radius-lg`. No borders.
- Lists: No horizontal dividers. Use alternating `surface` / `surface-container-low` rows.

### Inputs
- Surface: `surface-container-lowest` (white)
- Rest: Ghost border (`outline-variant` 15%)
- Focus: 2px `primary` border transition

### Sidebar Navigation
- Background: `surface-container-low`
- Active state: `primary-fixed` capsule with `on-primary-fixed-variant` text
- Inactive: `on-surface-variant` text

### Modals/Dropdowns
- Glassmorphism: `surface-variant` at 70% + blur(12px)
- `shadow-glass` for depth
- Backdrop: `on-surface` at 30% opacity

---

## What Changes

### globals.css

1. **Remove** the entire `.dark { ... }` block and all dark-mode selectors
2. **Replace** `@theme` block with Luminal Architect tokens
3. **Rewrite** glassmorphism utilities (`.glass` stays but with new values)
4. **Remove** old effects: `.glass-card`, `.gradient-border`, `.text-gradient`, `.glow-accent`, `.animate-glow-pulse`
5. **Add** new utilities: `.gradient-primary`, `.ghost-border`
6. **Add** tonal surface classes
7. **Update** body background to `surface` (#fcf8ff)
8. **Remove** `--gradient-brand`, `--gradient-mesh`, `--color-accent-glow`

### Theme Provider
Same as before — remove `next-themes`, `ThemeProvider`, theme toggles.

### Components (~30+ files)
Same file list as before (all files using glass/gradient/glow effects), but with updated replacement rules:

#### Replacement Rules

| Old pattern | Luminal Architect replacement |
|-------------|-------------------------------|
| `glass` (on sidebar/topbar) | `bg-[var(--color-surface-container-low)]` (sidebar) or `glass` (topbar if floating) |
| `glass-card` | `bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)]` |
| `gradient-border` | Remove — use tonal layering (white card on tinted bg creates lift) |
| `gradient-border:hover` | `hover:shadow-[var(--shadow-ambient)]` transition |
| `text-gradient` | `text-[var(--color-primary)]` |
| `glow-accent`, `accent-glow` | Remove entirely (no glows in Luminal) |
| `animate-glow-pulse` | Remove |
| `bg-gradient-to-r from-accent to-purple-*` (on buttons) | `gradient-primary` class |
| `bg-gradient-to-r from-accent to-purple-*` (other) | `bg-[var(--color-primary)]` solid |
| `to-purple-500` progress bars | `bg-[var(--color-primary)]` |
| `to-purple-500/5`, `/10` subtle | `bg-[var(--color-primary-fixed)]` or remove |
| `border border-[var(--color-border)]` (on cards) | Remove border OR use `.ghost-border` |
| `dark:*` classes | Remove all |
| `1px solid` borders between sections | Remove — use background color shifts |

#### Affected Files (same ~30 files as before)

**Layout:** sidebar.tsx, top-bar.tsx, mobile-nav.tsx
**UI:** button.tsx, card.tsx, badge.tsx, page-header.tsx, dialog.tsx, stat-card.tsx, tabs.tsx
**Pages:** login, analytics, my-profile, people/[id], time-off, reviews, org, calendar, welcome
**Feature:** club-card, ai-analytics-bar, post-card, post-composer, onboarding-timeline, people-list, employee-documents-section, hr-notes-section, add-employee-form, document-signing-manager, add-candidate-form, department-actions, company-info
**Dark class cleanup:** email-template-manager, candidate-database, burnout-alerts

---

## What Stays

- **Component architecture**: CVA variants, Tailwind utility classes, `cn()` helper
- **Layout structure**: Sidebar (desktop) + TopBar (sticky) + MobileNav (mobile bottom)
- **Animation system**: Framer Motion for page transitions, stagger effects, counters
- **Existing animations**: `fadeUp`, `pulse-slow` keyframes (remove `glow-pulse`)
- **Icon library**: Lucide React (superseded by Stitch alignment spec — migrating to Material Symbols Outlined)
- **All functionality and routing**: Zero functional changes

---

## Migration Strategy

1. **Update tokens in globals.css** — replace entire @theme block with tonal spectrum
2. **Add new utility classes** — `.gradient-primary`, `.ghost-border`, update `.glass`
3. **Update ~30 component files** — apply replacement rules
4. **Remove dark mode infrastructure** — ThemeProvider, theme toggle, dark: classes
5. **Remove all explicit borders on cards** — rely on tonal layering
6. **Audit and adjust** — verify each page follows the no-line rule and tonal hierarchy

Visual-only change. No database, API, or business logic modifications.
