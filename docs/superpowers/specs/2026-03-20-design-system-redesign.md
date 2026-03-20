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

### Components Using Glass/Gradient Effects

These components reference `.glass`, `.glass-card`, `.gradient-border`, `.text-gradient`, or `.glow-accent` and need updating:

- `src/components/layout/sidebar.tsx` — glass background, gradient active state
- `src/components/layout/top-bar.tsx` — glass background
- `src/components/ui/card.tsx` — gradient-border hover
- `src/components/ui/dialog.tsx` — glassmorphism overlay
- `src/components/ui/badge.tsx` — gradient variant
- `src/components/ui/tabs.tsx` — glass styling
- `src/components/ui/stat-card.tsx` — glow effects

**Replacement approach**: Replace glass backgrounds with `bg-surface` + `shadow-sm`. Replace gradient borders with `border-border hover:border-accent` + `shadow-md`. Replace text gradients with `text-accent`.

### Font Loading

Add Aeonik font files to `public/fonts/` and declare `@font-face` in globals.css. Apply `font-heading` to all `h1`–`h4` elements and page title components.

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
2. **Search and replace** glass/gradient class usage in components (~7 files)
3. **Remove theme infrastructure** — ThemeProvider, theme toggle, dark mode selectors
4. **Add Aeonik font** — font files + CSS + heading class updates
5. **Audit and adjust** — verify each page looks correct with new tokens

This is a visual-only change. No database, API, or business logic modifications.
