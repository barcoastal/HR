# HR Platform Design System & Visual Redesign

**Date**: 2026-03-20
**Status**: Draft
**Project**: CALATRAVA — Coastal Debt HR Platform

## Overview

Redesign the HR platform's visual identity from a dark-first glassmorphism aesthetic to a soft, warm, light-only design inspired by (but not strictly following) the Coastal Debt brand book. Establish a token-level design system as the foundation for all UI.

### Goals

1. **Visual cohesion** — Replace the inconsistent glassmorphism/gradient style with a unified warm, approachable look
2. **Brand alignment** — Adapt Coastal Debt brand colors and typography for an internal HR tool
3. **Maintainable tokens** — Define a single source of truth for colors, typography, spacing, shadows, and radii as CSS custom properties
4. **Smooth migration** — Components already consume CSS variables via Tailwind, so token changes cascade naturally

### Non-Goals

- Building a documented component library (tokens only — components stay custom)
- Adding new features or changing functionality
- Changing the component architecture (CVA + Tailwind stays)
- Changing the layout structure (sidebar + topbar + mobile nav stays)

---

## Design Direction

**Style**: Soft & warm — rounded corners, soft shadows, warm neutrals with brand color pops. Think Slack, Gusto. Friendly and approachable for daily use as an HR tool.

**Mode**: Light only. Remove dark mode support entirely.

**Typography**: Aeonik (headings) + Inter (body/UI). Brand presence in titles, proven readability for dense UI text.

---

## Design Tokens

### Color Palette

Derived from the Coastal Debt brand book, adapted for a warm internal tool feel.

#### Core

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `#F5F6FA` | Page background — slightly warmer than brand's #F2F4F9 |
| `--color-foreground` | `#1A1A2E` | Primary text — softer than pure black |
| `--color-surface` | `#FFFFFF` | Cards, panels, content areas |
| `--color-surface-hover` | `#F0F1F5` | Surface hover state |
| `--color-surface-raised` | `#FFFFFF` | Elevated surfaces (modals, dropdowns) |
| `--color-border` | `#E2E4ED` | Default borders |
| `--color-border-subtle` | `#EDEEF3` | Lighter borders for nested elements |

#### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--color-text-primary` | `#1A1A2E` | Headings, important text |
| `--color-text-secondary` | `#4A4D65` | Body text, descriptions |
| `--color-text-muted` | `#8B8FA8` | Placeholder, helper text, timestamps |
| `--color-text-on-accent` | `#FFFFFF` | Text on accent-colored backgrounds |

#### Brand / Accent

| Token | Value | Source | Usage |
|-------|-------|--------|-------|
| `--color-accent` | `#3052FF` | Brand "Future Blue" | Primary actions, links, active states |
| `--color-accent-hover` | `#2442E0` | Darker shade | Hover on accent elements |
| `--color-accent-light` | `rgba(48, 82, 255, 0.08)` | — | Light accent backgrounds, selected states |
| `--color-accent-lighter` | `rgba(48, 82, 255, 0.04)` | — | Very subtle accent tinting |
| `--color-secondary` | `#FF9000` | Brand "Orange" | Secondary CTAs, highlights, badges |
| `--color-secondary-hover` | `#E58200` | Darker shade | Hover on secondary elements |
| `--color-secondary-light` | `rgba(255, 144, 0, 0.08)` | — | Light secondary backgrounds |
| `--color-highlight` | `#7FB2FF` | Brand "Light Blue" | Informational highlights, decorative accents |

#### Semantic

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#10B981` | Success states, completed tasks |
| `--color-success-light` | `rgba(16, 185, 129, 0.08)` | Success backgrounds |
| `--color-warning` | `#F59E0B` | Warnings, pending states |
| `--color-warning-light` | `rgba(245, 158, 11, 0.08)` | Warning backgrounds |
| `--color-danger` | `#EF4444` | Errors, destructive actions |
| `--color-danger-light` | `rgba(239, 68, 68, 0.08)` | Danger backgrounds |
| `--color-info` | `#3B82F6` | Informational messages |
| `--color-info-light` | `rgba(59, 130, 246, 0.08)` | Info backgrounds |

### Typography

#### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--font-heading` | `"Aeonik", system-ui, sans-serif` | Headings (h1–h4), page titles |
| `--font-sans` | `"Inter", system-ui, sans-serif` | Body text, UI elements, labels |

#### Font Sizes

| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | `0.75rem` (12px) | Captions, timestamps, small badges |
| `--text-sm` | `0.875rem` (14px) | Body text, table cells, form labels |
| `--text-base` | `1rem` (16px) | Default body, input text |
| `--text-lg` | `1.125rem` (18px) | Section headings, card titles |
| `--text-xl` | `1.25rem` (20px) | Page subtitles |
| `--text-2xl` | `1.5rem` (24px) | Page titles |
| `--text-3xl` | `1.875rem` (30px) | Dashboard hero stats |

#### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-regular` | `400` | Body text (Inter Regular) |
| `--font-medium` | `500` | Labels, emphasized text (Inter Medium / Aeonik Medium) |
| `--font-semibold` | `600` | Headings, buttons (Inter Semibold) |
| `--font-bold` | `700` | Stat numbers, strong emphasis |

#### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-tight` | `1.25` | Headings |
| `--leading-normal` | `1.5` | Body text |
| `--leading-relaxed` | `1.75` | Long-form content |

### Spacing

Uses Tailwind's default spacing scale (4px base). No custom tokens needed — the standard `p-1` through `p-12` scale is sufficient.

**Consistent patterns to follow:**
- Page padding: `p-6` (24px) desktop, `p-4` (16px) mobile
- Card padding: `p-5` (20px) or `p-6` (24px)
- Section gap: `gap-6` (24px)
- Element gap: `gap-3` (12px) or `gap-4` (16px)
- Compact gap: `gap-2` (8px)

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `0.375rem` (6px) | Small elements: badges, chips |
| `--radius-md` | `0.5rem` (8px) | Buttons, inputs, small cards |
| `--radius-lg` | `0.75rem` (12px) | Cards, panels |
| `--radius-xl` | `1rem` (16px) | Modals, large cards |
| `--radius-full` | `9999px` | Avatars, pills |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0, 0, 0, 0.04)` | Subtle lift (inputs, small cards) |
| `--shadow-sm` | `0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)` | Cards at rest |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.07)` | Cards on hover, dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.09)` | Modals, popovers |
| `--shadow-focus` | `0 0 0 3px rgba(48, 82, 255, 0.15)` | Focus rings on interactive elements |

### Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `150ms ease` | Color changes, opacity |
| `--transition-base` | `200ms ease` | Most interactions |
| `--transition-slow` | `300ms ease` | Layout changes, expand/collapse |

---

## What Changes

### globals.css

1. **Remove** the entire `.dark { ... }` block
2. **Remove** dark-mode-specific selectors (`.dark .glass`, `.dark ::-webkit-scrollbar-thumb`)
3. **Replace** `@theme` block with new token values
4. **Remove** glassmorphism utilities (`.glass`, `.glass-card`)
5. **Remove** gradient effects (`.gradient-border`, `.text-gradient`, `.glow-accent`, `.animate-glow-pulse`)
6. **Replace** `--gradient-brand` and `--gradient-mesh` with simple accent references or remove
7. **Add** new shadow, radius, and typography tokens
8. **Add** `@font-face` declarations for Aeonik (Regular + Medium)
9. **Update** body styles to remove `background-image: var(--gradient-mesh)`

### Theme Provider

1. **Remove** `next-themes` dependency and `ThemeProvider` component
2. **Remove** theme toggle from sidebar and topbar
3. **Remove** `suppressHydrationWarning` from root layout's `<html>` tag

### Components Using Glass/Gradient/Glow Effects

Full list of files referencing `.glass`, `.glass-card`, `.gradient-border`, `.text-gradient`, `.glow-accent`, `.accent-glow`, `animate-glow-pulse`, inline `accent-glow` shadows, or inline `to-purple-600` gradients:

**Layout components:**
- `src/components/layout/sidebar.tsx` — `glass`, gradient active state
- `src/components/layout/top-bar.tsx` — `glass`
- `src/components/layout/mobile-nav.tsx` — `glass`

**UI components:**
- `src/components/ui/card.tsx` — `gradient-border`
- `src/components/ui/dialog.tsx` — glassmorphism overlay
- `src/components/ui/badge.tsx` — gradient variant
- `src/components/ui/tabs.tsx` — glass styling
- `src/components/ui/stat-card.tsx` — glow effects
- `src/components/ui/button.tsx` — `glow-accent`, inline `to-purple-600` gradient
- `src/components/ui/page-header.tsx` — `text-gradient`

**Page files:**
- `src/app/(dashboard)/analytics/page.tsx` — `glass-card`, `gradient-border` (12+ uses)
- `src/app/(dashboard)/my-profile/page.tsx` — `gradient-border`, `text-gradient`
- `src/app/(dashboard)/people/[id]/page.tsx` — `gradient-border`, `text-gradient`
- `src/app/(dashboard)/time-off/page.tsx` — `gradient-border`
- `src/app/(dashboard)/reviews/page.tsx` — `gradient-border`, `to-purple-500` progress bar
- `src/app/(dashboard)/org/page.tsx` — `gradient-border`
- `src/app/(dashboard)/calendar/page.tsx` — `glass-card`
- `src/app/(dashboard)/welcome/page.tsx` — `to-purple-500` progress bar gradient
- `src/app/(auth)/login/page.tsx` — `glass-card`, `animate-glow-pulse`, `accent-glow`, `to-purple-500/5` background

**Feature components:**
- `src/components/clubs/club-card.tsx` — `gradient-border`
- `src/components/analytics/ai-analytics-bar.tsx` — `glass-card`, `glow-accent`
- `src/components/feed/post-card.tsx` — `gradient-border`, `to-purple-500/10` decorative gradient
- `src/components/feed/post-composer.tsx` — `accent-glow`
- `src/components/onboarding/onboarding-timeline.tsx` — `gradient-border`, `to-purple-500` progress bar
- `src/components/people/people-list.tsx` — `gradient-border`, `accent-glow`
- `src/components/people/employee-documents-section.tsx` — `gradient-border`
- `src/components/people/hr-notes-section.tsx` — `gradient-border`
- `src/components/people/add-employee-form.tsx` — `accent-glow`
- `src/components/documents/document-signing-manager.tsx` — `glass-card`, inline `accent-glow` shadow
- `src/components/cv/add-candidate-form.tsx` — `accent-glow`
- `src/components/org/department-actions.tsx` — `accent-glow`
- `src/components/settings/company-info.tsx` — `accent-glow`

**Total: ~30 files** requiring class replacement.

#### Replacement Rules

| Old pattern | Replacement |
|-------------|-------------|
| `glass`, `glass-card` | `bg-surface shadow-sm border border-border` |
| `gradient-border` | `border border-border hover:border-accent hover:shadow-md transition-all` |
| `text-gradient` | `text-accent` |
| `glow-accent`, `accent-glow` | `shadow-sm` (remove glow entirely) |
| `animate-glow-pulse` | Remove (no replacement needed) |
| Inline `shadow-[..accent-glow..]` | `shadow-sm` or `shadow-focus` for focus states |
| All `to-purple-*` gradient patterns (600, 500, 500/10, 500/5) | See sub-rules below |
| Solid gradient backgrounds (`to-purple-600`, `to-purple-500`) | `bg-accent` |
| Progress bar gradients (`to-purple-500`) | `bg-accent` |
| Subtle/decorative gradients (`to-purple-500/5`, `to-purple-500/10`) | `bg-accent-light` or remove |
| Badge gradient variant (`to-purple-500/10`) | Replace with non-gradient badge style |
| `bg-gradient-to-r from-[var(--color-accent)] to-purple-600` | `bg-accent` |

#### Removed Tokens (no longer defined)

These tokens/variables are removed and all references must be updated:
- `--color-accent-glow` — replaced by `--shadow-focus` for focus rings, removed elsewhere
- `--gradient-brand` — replace with solid `--color-accent`
- `--gradient-brand-subtle` — replace with `--color-accent-light`
- `--gradient-mesh` — removed (no replacement, body uses flat background)

### Font Loading

**Available Aeonik weights**: Regular (400) and Medium (500) only.

Add Aeonik font files to `public/fonts/` and declare `@font-face` in globals.css:
- `Aeonik-Regular.woff2` — weight 400
- `Aeonik-Medium.woff2` — weight 500

**Application method**: Register `--font-heading` in the Tailwind `@theme` block, then add a global CSS rule:
```css
h1, h2, h3, h4 { font-family: var(--font-heading); }
```

The `page-header.tsx` component should also use `font-heading` for its title.

**Weight mapping note**: Aeonik only provides Regular (400) and Medium (500). Headings should use `font-medium` (500) with Aeonik. Weights 600+ (`font-semibold`, `font-bold`) only apply to Inter-rendered text (body, UI, stat numbers).

### New Tokens: Application Guidance

- `--color-surface-raised` and `--color-border-subtle` — introduced for future use. No existing components need to adopt them during this migration. Available for modals/dropdowns and nested card borders.
- `--color-secondary` (Orange #FF9000) — introduced for secondary CTAs and badge accents. No mandatory adoption during migration, but the badge `warning` variant may optionally switch to this.
- `--color-highlight` (Light Blue #7FB2FF) — decorative accent for future use.
- `--color-text-secondary` (#4A4D65) — fixes a pre-existing bug where 2 files reference this undefined token. Will work automatically once defined.
- `--color-info` (#3B82F6) — intentionally close to `--color-accent` (#3052FF). Info is a semantic state color used for toast/alert contexts; accent is the interactive/brand color. The similar hue is acceptable since they serve different roles and rarely appear together.

---

## What Stays

- **Component architecture**: CVA variants, Tailwind utility classes, `cn()` helper
- **Layout structure**: Sidebar (desktop) + TopBar (sticky) + MobileNav (mobile bottom)
- **Animation system**: Framer Motion for page transitions, stagger effects, counters
- **Existing animations**: `fadeUp`, `pulse-slow` keyframes (remove `glow-pulse`)
- **Icon library**: Lucide React (line-style icons already align with brand guidelines)
- **All functionality and routing**: Zero functional changes

---

## Migration Strategy

Since all components already consume CSS variables through Tailwind, the migration is primarily:

1. **Update tokens in globals.css** — most changes cascade automatically
2. **Search and replace** glass/gradient/glow class usage in components (~30 files, see full list above)
3. **Replace inline purple gradients** — 11+ files use `to-purple-600`, replace with solid `bg-accent`
4. **Remove theme infrastructure** — ThemeProvider, theme toggle, dark mode selectors
5. **Add Aeonik font** — font files + `@font-face` + global heading rule + `@theme` registration
6. **Audit and adjust** — verify each page looks correct with new tokens

This is a visual-only change. No database, API, or business logic modifications.
