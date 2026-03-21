# Luminal Architect Design System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the HR platform from dark glassmorphism to the Luminal Architect design system — indigo palette, tonal layering, no-line boundaries, editorial typography.

**Architecture:** Token-level redesign — update CSS custom properties in globals.css, add new utility classes, then update ~30 component files. Remove dark mode entirely.

**Tech Stack:** Tailwind CSS v4 (@theme), CSS custom properties, CVA, Framer Motion (kept)

**Spec:** `docs/superpowers/specs/2026-03-20-design-system-redesign.md`

---

## Chunk 1: Foundation — New Tokens & Utilities

### Task 1: Replace globals.css with Luminal Architect tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the entire globals.css**

Replace the full contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;

  /* Surfaces — tonal spectrum */
  --color-surface: #fcf8ff;
  --color-surface-container: #efecfd;
  --color-surface-container-low: #f5f2ff;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-highest: #e3e0f2;
  --color-surface-variant: #e3e0f2;

  /* Legacy mappings (consumed by existing components via Tailwind) */
  --color-background: #fcf8ff;
  --color-foreground: #1a1a27;
  --color-surface-hover: #efecfd;

  /* Text */
  --color-on-surface: #1a1a27;
  --color-on-surface-variant: #484555;
  --color-text-primary: #1a1a27;
  --color-text-secondary: #484555;
  --color-text-muted: #78758a;
  --color-on-primary: #ffffff;
  --color-text-on-accent: #ffffff;

  /* Primary — Indigo */
  --color-primary: #5b3cdd;
  --color-primary-container: #7459f7;
  --color-primary-fixed: #e5deff;
  --color-on-primary-fixed-variant: #441cc8;
  --color-accent: #5b3cdd;
  --color-accent-hover: #4a2fc4;
  --color-accent-light: rgba(91, 60, 221, 0.08);

  /* Outline */
  --color-outline-variant: #c9c4d8;
  --color-border: rgba(201, 196, 216, 0.15);
  --color-border-subtle: rgba(201, 196, 216, 0.10);

  /* Semantic */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #7459f7;

  /* Shadows — tinted ambient */
  --shadow-ambient: 0 20px 40px rgba(26, 26, 39, 0.06);
  --shadow-glass: 0 8px 32px rgba(26, 26, 39, 0.08);
  --shadow-focus: 0 0 0 3px rgba(91, 60, 221, 0.2);

  /* Radius — strict: md for controls, lg for containers */
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;
}

/* Base styles */
body {
  background-color: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-sans);
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 3px; }

/* Glassmorphism — floating elements only */
.glass {
  background: rgba(227, 224, 242, 0.70);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Primary gradient — CTAs only */
.gradient-primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%);
}

/* Ghost border — 15% opacity only */
.ghost-border {
  outline: 1px solid rgba(201, 196, 216, 0.15);
}
.ghost-border-focus {
  outline: 2px solid var(--color-primary);
}

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-up {
  animation: fadeUp 0.4s ease-out both;
}

@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse-slow {
  animation: pulse-slow 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: replace design tokens with Luminal Architect tonal spectrum

New indigo palette, tonal surfaces, ghost borders, gradient-primary utility.
Removes dark mode, old glassmorphism, gradient-border, text-gradient, glow effects."
```

---

### Task 2: Remove dark mode infrastructure

**Files:**
- Modify: `src/app/layout.tsx`
- Delete: `src/components/layout/theme-provider.tsx`
- Modify: `package.json`

- [ ] **Step 1: Update root layout**

In `src/app/layout.tsx`, make ONLY these targeted changes (preserve all other imports, metadata, dynamic export):
1. Remove: `import { ThemeProvider } from "@/components/layout/theme-provider";`
2. Remove `suppressHydrationWarning` from the `<html>` tag
3. Remove the `<ThemeProvider>` wrapper tags, keeping `<SessionProvider>` and `{children}` inside

- [ ] **Step 2: Delete theme-provider.tsx**

```bash
rm src/components/layout/theme-provider.tsx
```

- [ ] **Step 3: Remove next-themes**

```bash
cd /Users/baralezrah/hr-platform && npm uninstall next-themes
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove dark mode — delete ThemeProvider, uninstall next-themes"
```

---

## Chunk 2: UI Components

### Task 3: Update button component

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Replace button variants**

Replace the variants object:

```typescript
variant: {
  default:
    "gradient-primary text-white shadow-none hover:shadow-[var(--shadow-ambient)] hover:brightness-105 transition-all",
  secondary:
    "bg-transparent text-[var(--color-primary)] ghost-border hover:bg-[var(--color-primary-fixed)] transition-all",
  ghost:
    "bg-transparent text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] transition-all",
  destructive:
    "bg-[var(--color-danger)] text-white shadow-none hover:shadow-[var(--shadow-ambient)] hover:brightness-105 transition-all",
},
```

Also update the base class: change `rounded-xl` to `rounded-[var(--radius-md)]`. Remove `glow-accent` from the base class if present.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: button — gradient primary, ghost border secondary, remove glow"
```

---

### Task 4: Update card component

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Replace Card root className**

Change from:
```
"gradient-border rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-300 hover:shadow-xl"
```

to:
```
"rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] transition-all duration-200 hover:shadow-[var(--shadow-ambient)]"
```

No border. White card on tinted background creates lift via tonal layering.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: card — tonal layering, no border, ambient hover shadow"
```

---

### Task 5: Update badge component

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Replace variants**

```typescript
variant: {
  default: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
  secondary: "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]",
  success: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  destructive: "bg-red-500/10 text-red-600",
  gradient: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
},
```

Remove `dark:` classes. Change `rounded-lg` to `rounded-[var(--radius-md)]`.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: badge — primary-fixed default, remove dark classes"
```

---

### Task 6: Update page-header component

**Files:**
- Modify: `src/components/ui/page-header.tsx`

- [ ] **Step 1: Replace text-gradient**

Change:
```
gradient ? "text-gradient" : "text-[var(--color-text-primary)]"
```
to:
```
gradient ? "text-[var(--color-primary)]" : "text-[var(--color-on-surface)]"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/page-header.tsx
git commit -m "feat: page-header — primary color instead of gradient text"
```

---

### Task 7: Update dialog, stat-card, and tabs

**Files:**
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/stat-card.tsx`
- Modify: `src/components/ui/tabs.tsx`

- [ ] **Step 1: dialog.tsx**

The backdrop overlay (`bg-black/50 backdrop-blur-sm`) — change to `bg-[var(--color-on-surface)]/30 backdrop-blur-sm`.

The dialog panel — if it uses `glass-card` or hardcoded bg, replace with:
```
"glass rounded-[var(--radius-lg)] shadow-[var(--shadow-glass)]"
```

- [ ] **Step 2: stat-card.tsx**

Remove all `dark:` prefixed classes from the `colorSchemes` object.
Remove any `gradient-border` — use no border.
Remove any `glow-accent` or `accent-glow`.

- [ ] **Step 3: tabs.tsx**

Remove `glass` class if used on the tab list container. Replace with `bg-[var(--color-surface-container)]`.
Remove any `dark:` prefixed classes.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/stat-card.tsx src/components/ui/tabs.tsx
git commit -m "feat: dialog glass overlay, stat-card + tabs tonal updates"
```

---

## Chunk 3: Layout Components

### Task 8: Update sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Remove useTheme and theme toggle**

Remove `import { useTheme } from "next-themes"` and `const { theme, setTheme } = useTheme()`.
Remove the entire theme toggle button block (Sun/Moon icons). Remove Sun/Moon imports from lucide-react if unused.

- [ ] **Step 2: Replace sidebar background**

Change aside from `glass` to `bg-[var(--color-surface-container-low)]`. The sidebar is a fixed tonal pillar, not floating glass.

- [ ] **Step 3: Replace active nav state**

Change active link from `bg-[var(--color-accent)]/10 text-[var(--color-accent)]` to:
```
"bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)] rounded-[var(--radius-md)]"
```

Change the active indicator bar from gradient to solid `bg-[var(--color-primary)]`.

- [ ] **Step 4: Replace logo icon and company name**

Logo icon: change `bg-gradient-to-br from-[var(--color-accent)] to-purple-600 shadow-lg shadow-[var(--color-accent-glow)]` to `gradient-primary shadow-none`.

Company name: change `text-gradient` to `text-[var(--color-on-surface)] font-semibold`.

- [ ] **Step 5: Replace user avatar fallback**

Change gradient avatar to `bg-[var(--color-primary)]`.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: sidebar — tonal pillar, primary-fixed active state, remove theme toggle"
```

---

### Task 9: Update top-bar and mobile-nav

**Files:**
- Modify: `src/components/layout/top-bar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1: top-bar — remove useTheme + theme toggle**

Same as sidebar: remove import, destructuring, toggle button, Sun/Moon icons.

- [ ] **Step 2: top-bar — update styling**

The header can keep `glass` class (it's a floating element). But replace the border:
- Remove `border-b border-[var(--color-border)]/60`
- Add `shadow-[var(--shadow-glass)]` for depth

Search input: remove `glass` class, use `bg-[var(--color-surface-container-lowest)]`. On focus, transition to 2px primary border.

Mobile title: change `text-gradient` to `text-[var(--color-on-surface)]`.

Avatar fallback: change gradient to `bg-[var(--color-primary)]`.

- [ ] **Step 3: mobile-nav — replace glass**

Replace `glass` with `bg-[var(--color-surface-container-low)]`. Mobile nav is a fixed pillar, not floating.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/top-bar.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat: top-bar glass + shadow, mobile-nav tonal bg, remove theme toggles"
```

---

## Chunk 4: Pages

### Task 10: Update login page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace glass-card**

Change `glass-card rounded-3xl p-8` to `bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-ambient)]`.

- [ ] **Step 2: Replace purple background orbs**

Change `to-purple-500/5` and `bg-purple-500/10` references to use `var(--color-primary)` at low opacity:
- Background gradient: `from-[var(--color-primary)]/5 via-transparent to-transparent`
- Blur orbs: `bg-[var(--color-primary)]/8`

- [ ] **Step 3: Replace glow-pulse logo**

Remove `animate-glow-pulse` and `shadow-[0_0_20px_var(--color-accent-glow)]`.
Change gradient to `gradient-primary`. Add `shadow-[var(--shadow-ambient)]`.

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat: login — tonal card, primary orbs, remove glow"
```

---

### Task 11: Update analytics page

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Batch replace across entire file (12+ occurrences)**

- `glass-card` → `bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)]`
- `gradient-border` → remove (card component handles hover now)
- Remove all `dark:` classes
- Remove all explicit `border border-[var(--color-border)]` on cards (tonal layering)

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/analytics/page.tsx
git commit -m "feat: analytics — tonal cards, remove glass and gradient borders"
```

---

### Task 12: Batch update remaining dashboard pages

**Files:**
- Modify: `src/app/(dashboard)/my-profile/page.tsx`
- Modify: `src/app/(dashboard)/people/[id]/page.tsx`
- Modify: `src/app/(dashboard)/time-off/page.tsx`
- Modify: `src/app/(dashboard)/org/page.tsx`
- Modify: `src/app/(dashboard)/calendar/page.tsx`
- Modify: `src/app/(dashboard)/reviews/page.tsx`
- Modify: `src/app/(dashboard)/welcome/page.tsx`

- [ ] **Step 1: For each file, apply these replacements**

- `gradient-border` → remove
- `text-gradient` → `text-[var(--color-primary)]`
- `glass-card` → `bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)]`
- `to-purple-500` / `to-purple-600` progress bars → `bg-[var(--color-primary)]`
- Remove `dark:` classes
- Remove explicit card borders where tonal layering suffices

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/
git commit -m "feat: dashboard pages — tonal surfaces, primary color, remove gradients"
```

---

## Chunk 5: Feature Components

### Task 13: Update gradient-border components

**Files:**
- Modify: `src/components/clubs/club-card.tsx`
- Modify: `src/components/people/employee-documents-section.tsx`
- Modify: `src/components/people/hr-notes-section.tsx`
- Modify: `src/components/feed/post-card.tsx`
- Modify: `src/components/onboarding/onboarding-timeline.tsx`
- Modify: `src/components/people/people-list.tsx`

- [ ] **Step 1: Apply replacements across all files**

- `gradient-border` → remove
- `to-purple-*` gradients → `bg-[var(--color-primary)]`
- `to-purple-*/10` or `/5` → `bg-[var(--color-primary-fixed)]` or remove
- `accent-glow` / inline glow shadows → remove
- Remove explicit card borders

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/ src/components/people/ src/components/feed/ src/components/onboarding/
git commit -m "feat: feature components — remove gradient-border, purple gradients, glows"
```

---

### Task 14: Update accent-glow and glass components

**Files:**
- Modify: `src/components/analytics/ai-analytics-bar.tsx`
- Modify: `src/components/feed/post-composer.tsx`
- Modify: `src/components/people/add-employee-form.tsx`
- Modify: `src/components/documents/document-signing-manager.tsx`
- Modify: `src/components/cv/add-candidate-form.tsx`
- Modify: `src/components/org/department-actions.tsx`
- Modify: `src/components/settings/company-info.tsx`

- [ ] **Step 1: Apply replacements**

- `glass-card` → `bg-[var(--color-surface-container-lowest)] rounded-[var(--radius-lg)]`
- `glow-accent` / `accent-glow` → remove
- Inline `shadow-[0_0_*_var(--color-accent-glow)]` → remove
- `to-purple-*` gradients → `bg-[var(--color-primary)]`

- [ ] **Step 2: Commit**

```bash
git add src/components/analytics/ src/components/feed/ src/components/people/ src/components/documents/ src/components/cv/ src/components/org/ src/components/settings/
git commit -m "feat: remaining components — remove glass-card, accent-glow, purple gradients"
```

---

## Chunk 6: Cleanup & Verification

### Task 15: Global sweep for remaining old patterns

- [ ] **Step 1: Search for stragglers**

```bash
cd /Users/baralezrah/hr-platform
grep -r "dark:" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
grep -r "glass-card\|gradient-border\|text-gradient\|glow-accent\|accent-glow\|animate-glow-pulse\|to-purple" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
grep -r "useTheme\|next-themes\|ThemeProvider" src/ --include="*.tsx" --include="*.ts" -l
grep -r "color-accent-glow\|gradient-brand\|gradient-mesh" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
```

Known files with `dark:` classes:
- `src/components/settings/email-template-manager.tsx`
- `src/components/cv/candidate-database.tsx`
- `src/components/time-off/burnout-alerts.tsx`

- [ ] **Step 2: Fix all remaining references**

- `dark:` → remove
- Old class names → apply replacement rules from spec
- `useTheme` / ThemeProvider → remove
- Old CSS var references → update

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: final cleanup — remove all remaining dark mode and old class references"
```

---

### Task 16: Build verification and deploy

- [ ] **Step 1: Run build**

```bash
cd /Users/baralezrah/hr-platform && npx next build
```

Expected: Success with no errors.

- [ ] **Step 2: Fix any build errors**

TypeScript errors from removed imports/variables — fix by removing the offending code.

- [ ] **Step 3: Visual spot-check**

```bash
npx next dev
```

Verify at http://localhost:3000:
- Login: white card on lavender background, no glass effect on card, gradient primary button for CTA
- Sidebar: `surface-container-low` pillar, `primary-fixed` active state
- Cards: white on lavender, no borders, ambient hover shadow
- Buttons: gradient primary (indigo), ghost border secondary
- Page headers: primary indigo color, not gradient text
- No purple-600 anywhere, no glow effects, no 1px borders on cards
- Typography: Inter everywhere with tight tracking on display sizes

- [ ] **Step 4: Final commit and deploy**

```bash
git add -A
git commit -m "feat: Luminal Architect design system — complete redesign"
git push origin main
```
