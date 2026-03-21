# Design System & Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the HR platform from a dark-first glassmorphism aesthetic to a soft, warm, light-only design system with Coastal Debt brand-inspired tokens.

**Architecture:** Token-level redesign — update CSS custom properties in globals.css (which cascade through all components via Tailwind), then replace ~30 files that use glass/gradient/glow classes with clean alternatives. Remove dark mode infrastructure entirely.

**Tech Stack:** Tailwind CSS v4 (@theme), CSS custom properties, CVA (class-variance-authority), Framer Motion (kept as-is)

**Spec:** `docs/superpowers/specs/2026-03-20-design-system-redesign.md`

---

## File Structure

**Modified files:**
- `src/app/globals.css` — Complete token replacement, remove glass/gradient/dark classes
- `src/app/layout.tsx` — Remove ThemeProvider wrapper, suppressHydrationWarning
- `src/components/layout/theme-provider.tsx` — Delete entirely
- `src/components/layout/sidebar.tsx` — Remove glass, gradients, theme toggle, useTheme
- `src/components/layout/top-bar.tsx` — Remove glass, theme toggle, useTheme
- `src/components/layout/mobile-nav.tsx` — Remove glass
- `src/components/ui/button.tsx` — Replace gradient + glow default variant
- `src/components/ui/card.tsx` — Replace gradient-border
- `src/components/ui/badge.tsx` — Replace gradient variant, remove dark: classes
- `src/components/ui/page-header.tsx` — Replace text-gradient
- `src/components/ui/dialog.tsx` — Replace glass overlay
- `src/components/ui/stat-card.tsx` — Remove dark: classes from color schemes
- `src/components/ui/tabs.tsx` — Remove glass styling
- `src/app/(auth)/login/page.tsx` — Replace glass-card, glow-pulse, purple orbs
- `src/app/(dashboard)/analytics/page.tsx` — Replace glass-card, gradient-border (12+ uses)
- `src/app/(dashboard)/my-profile/page.tsx` — Replace gradient-border, text-gradient
- `src/app/(dashboard)/people/[id]/page.tsx` — Replace gradient-border, text-gradient
- `src/app/(dashboard)/time-off/page.tsx` — Replace gradient-border
- `src/app/(dashboard)/reviews/page.tsx` — Replace gradient-border, to-purple-500
- `src/app/(dashboard)/org/page.tsx` — Replace gradient-border
- `src/app/(dashboard)/calendar/page.tsx` — Replace glass-card
- `src/app/(dashboard)/welcome/page.tsx` — Replace to-purple-500 gradient
- `src/components/clubs/club-card.tsx` — Replace gradient-border
- `src/components/analytics/ai-analytics-bar.tsx` — Replace glass-card, glow-accent
- `src/components/feed/post-card.tsx` — Replace gradient-border, to-purple-500/10
- `src/components/feed/post-composer.tsx` — Replace accent-glow
- `src/components/onboarding/onboarding-timeline.tsx` — Replace gradient-border, to-purple-500
- `src/components/people/people-list.tsx` — Replace gradient-border, accent-glow
- `src/components/people/employee-documents-section.tsx` — Replace gradient-border
- `src/components/people/hr-notes-section.tsx` — Replace gradient-border
- `src/components/people/add-employee-form.tsx` — Replace accent-glow
- `src/components/documents/document-signing-manager.tsx` — Replace glass-card, accent-glow shadow
- `src/components/cv/add-candidate-form.tsx` — Replace accent-glow
- `src/components/org/department-actions.tsx` — Replace accent-glow
- `src/components/settings/company-info.tsx` — Replace accent-glow
- `src/components/settings/email-template-manager.tsx` — Remove dark: classes
- `src/components/cv/candidate-database.tsx` — Remove dark: classes
- `src/components/time-off/burnout-alerts.tsx` — Remove dark: classes
- `package.json` — Remove next-themes dependency

**Created files:**
- `public/fonts/Aeonik-Regular.woff2` — Font file (must be sourced manually)
- `public/fonts/Aeonik-Medium.woff2` — Font file (must be sourced manually)

---

## Chunk 1: Foundation — Tokens, Fonts, and Dark Mode Removal

### Task 1: Add Aeonik font files

**Files:**
- Create: `public/fonts/Aeonik-Regular.woff2`
- Create: `public/fonts/Aeonik-Medium.woff2`

- [ ] **Step 1: Create fonts directory**

```bash
mkdir -p public/fonts
```

- [ ] **Step 2: Source Aeonik font files**

Copy Aeonik-Regular.woff2 and Aeonik-Medium.woff2 into `public/fonts/`. These must be sourced from the company's licensed font files. Check if they exist anywhere on the machine:

```bash
find /Users/baralezrah -name "Aeonik*" -type f 2>/dev/null | head -20
```

If not found locally, the user must provide them. Do NOT proceed without real font files.

- [ ] **Step 3: Commit**

```bash
git add public/fonts/
git commit -m "feat: add Aeonik font files for design system"
```

---

### Task 2: Replace globals.css with new design tokens

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the entire globals.css**

Replace the full contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

@font-face {
  font-family: "Aeonik";
  src: url("/fonts/Aeonik-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Aeonik";
  src: url("/fonts/Aeonik-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@theme {
  /* Typography */
  --font-heading: "Aeonik", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, sans-serif;

  /* Core palette */
  --color-background: #F5F6FA;
  --color-foreground: #1A1A2E;
  --color-surface: #FFFFFF;
  --color-surface-hover: #F0F1F5;
  --color-surface-raised: #FFFFFF;
  --color-border: #E2E4ED;
  --color-border-subtle: #EDEEF3;

  /* Text */
  --color-text-primary: #1A1A2E;
  --color-text-secondary: #4A4D65;
  --color-text-muted: #8B8FA8;
  --color-text-on-accent: #FFFFFF;

  /* Brand / Accent */
  --color-accent: #3052FF;
  --color-accent-hover: #2442E0;
  --color-accent-light: rgba(48, 82, 255, 0.08);
  --color-accent-lighter: rgba(48, 82, 255, 0.04);
  --color-secondary: #FF9000;
  --color-secondary-hover: #E58200;
  --color-secondary-light: rgba(255, 144, 0, 0.08);
  --color-highlight: #7FB2FF;

  /* Semantic */
  --color-success: #10B981;
  --color-success-light: rgba(16, 185, 129, 0.08);
  --color-warning: #F59E0B;
  --color-warning-light: rgba(245, 158, 11, 0.08);
  --color-danger: #EF4444;
  --color-danger-light: rgba(239, 68, 68, 0.08);
  --color-info: #3B82F6;
  --color-info-light: rgba(59, 130, 246, 0.08);

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.09);
  --shadow-focus: 0 0 0 3px rgba(48, 82, 255, 0.15);

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}

/* Heading font */
h1, h2, h3, h4 {
  font-family: var(--font-heading);
}

/* Base styles */
body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

/* Animations */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

- [ ] **Step 2: Verify the app still compiles**

```bash
cd /Users/baralezrah/hr-platform && npx next build 2>&1 | tail -5
```

Note: Build will have warnings about removed classes (glass, gradient-border, etc.) still being referenced. That's expected — we'll fix those in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: replace design tokens with new warm light-only palette

Removes dark mode, glassmorphism, gradient utilities.
Adds Aeonik font-face, new color tokens, shadow/radius tokens."
```

---

### Task 3: Remove dark mode infrastructure

**Files:**
- Modify: `src/app/layout.tsx`
- Delete: `src/components/layout/theme-provider.tsx`
- Modify: `package.json` (remove next-themes)

- [ ] **Step 1: Update root layout — remove ThemeProvider**

In `src/app/layout.tsx`, make ONLY these targeted changes (preserve all other imports, metadata export, dynamic export, etc.):

1. Remove the import: `import { ThemeProvider } from "@/components/layout/theme-provider";`
2. Remove `suppressHydrationWarning` from the `<html>` tag
3. Remove the `<ThemeProvider>` wrapper tags, keeping everything inside (`<SessionProvider>` and `{children}`)

**IMPORTANT:** Do NOT replace the whole file. Keep the existing `Metadata` import, `metadata` export (title, description, favicon), `dynamic` export, and all other content. Only remove the 3 items listed above.

- [ ] **Step 2: Delete theme-provider.tsx**

```bash
rm src/components/layout/theme-provider.tsx
```

- [ ] **Step 3: Remove next-themes from package.json**

```bash
cd /Users/baralezrah/hr-platform && npm uninstall next-themes
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove dark mode infrastructure

Remove ThemeProvider, next-themes dependency, and suppressHydrationWarning."
```

---

## Chunk 2: UI Component Updates

### Task 4: Update button component

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Replace default variant**

In `src/components/ui/button.tsx`, change the `default` variant from:

```
"bg-gradient-to-r from-[var(--color-accent)] to-purple-600 text-white shadow-sm glow-accent hover:shadow-lg hover:brightness-110"
```

to:

```
"bg-[var(--color-accent)] text-white shadow-sm hover:bg-[var(--color-accent-hover)] hover:shadow-md"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: update button to solid accent instead of gradient"
```

---

### Task 5: Update card component

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Replace gradient-border**

In `src/components/ui/card.tsx`, change the Card root className from:

```
"gradient-border rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-300 hover:shadow-xl"
```

to:

```
"rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-all duration-200 hover:border-[var(--color-accent)]/30 hover:shadow-md"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: update card to soft hover instead of gradient border"
```

---

### Task 6: Update badge component

**Files:**
- Modify: `src/components/ui/badge.tsx`

- [ ] **Step 1: Replace gradient variant and remove dark: classes**

Replace the variants object in `badgeVariants`:

```typescript
variant: {
  default: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  secondary: "bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)]",
  success: "bg-green-500/10 text-green-600",
  warning: "bg-yellow-500/10 text-yellow-600",
  destructive: "bg-red-500/10 text-red-600",
  gradient: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
},
```

Note: `gradient` variant becomes identical to `default` — it's kept for backward compatibility so no call sites break.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat: update badge — remove dark: classes and gradient variant"
```

---

### Task 7: Update page-header component

**Files:**
- Modify: `src/components/ui/page-header.tsx`

- [ ] **Step 1: Replace text-gradient with text-accent**

In the `h1` className, change:

```
gradient ? "text-gradient" : "text-[var(--color-text-primary)]"
```

to:

```
gradient ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/page-header.tsx
git commit -m "feat: update page-header to use accent color instead of gradient text"
```

---

### Task 8: Update dialog component

**Files:**
- Modify: `src/components/ui/dialog.tsx`

- [ ] **Step 1: Check for glass/glassmorphism classes**

Read the dialog component and replace any `glass-card` or glassmorphism-related classes on the dialog panel. The backdrop `bg-black/50 backdrop-blur-sm` can stay — that's a standard overlay pattern, not glassmorphism.

If the dialog panel uses `glass-card`, replace with:

```
"bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg"
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "feat: update dialog — remove glassmorphism"
```

---

### Task 9: Update stat-card component

**Files:**
- Modify: `src/components/ui/stat-card.tsx`

- [ ] **Step 1: Remove all `dark:` class references**

In the `colorSchemes` object, remove all `dark:` prefixed classes. For example, change:

```
"bg-blue-500/10 dark:bg-blue-500/15"
```

to:

```
"bg-blue-500/10"
```

Do this for every color scheme entry (blue, emerald, purple, etc.).

Also remove any `glow-accent` or `accent-glow` classes if present.

If the root div uses `gradient-border`, replace with `border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:shadow-md transition-all`.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/stat-card.tsx
git commit -m "feat: update stat-card — remove dark mode classes and gradient-border"
```

---

### Task 10: Update tabs component

**Files:**
- Modify: `src/components/ui/tabs.tsx`

- [ ] **Step 1: Remove glass styling**

Read the tabs component and remove any `glass` class references. Replace with `bg-[var(--color-surface)]` if the glass class was providing a background. Remove any `dark:` prefixed classes.

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/tabs.tsx
git commit -m "feat: update tabs — remove glass styling"
```

---

## Chunk 3: Layout Component Updates

### Task 11: Update sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Remove useTheme import and all theme toggle code**

Remove:
```typescript
import { useTheme } from "next-themes";
```

Remove `const { theme, setTheme } = useTheme();` (or similar destructuring).

Remove the entire theme toggle `<button>` block that references `setTheme` / `theme` — this is the Sun/Moon icon toggle button. Also remove the `Sun` and `Moon` imports from `lucide-react` if they are no longer used elsewhere. Keep the sign-out button and user info section.

- [ ] **Step 2: Replace glass class on aside**

Change the aside className from:

```
"glass fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col"
```

to:

```
"fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col bg-[var(--color-surface)]"
```

- [ ] **Step 3: Replace gradient logo icon**

Change the logo icon container from:

```
"flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 shadow-lg shadow-[var(--color-accent-glow)]"
```

to:

```
"flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent)] shadow-sm"
```

- [ ] **Step 4: Replace text-gradient on company name**

Change:
```
"text-lg font-bold text-gradient"
```

to:
```
"text-lg font-bold text-[var(--color-text-primary)]"
```

- [ ] **Step 5: Replace gradient active indicator**

Change the active link indicator from:

```
"absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-[var(--color-accent)] to-purple-500"
```

to:

```
"absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-[var(--color-accent)]"
```

- [ ] **Step 6: Replace gradient user avatar fallback**

Change:
```
"flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-purple-600 text-xs font-semibold text-white"
```

to:
```
"flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-white"
```

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: update sidebar — remove glass, gradients, theme toggle"
```

---

### Task 12: Update top-bar

**Files:**
- Modify: `src/components/layout/top-bar.tsx`

- [ ] **Step 1: Remove useTheme import and all theme toggle code**

Remove:
```typescript
import { useTheme } from "next-themes";
```

Remove `const { theme, setTheme } = useTheme();` (or similar destructuring).

Remove the entire theme toggle `<button>` block that references `setTheme` / `theme` — the Sun/Moon icon toggle. Also remove `Sun` and `Moon` imports from `lucide-react` if no longer used.

- [ ] **Step 2: Replace glass on header**

Change:
```
"glass sticky top-0 z-40 flex h-16 items-center justify-between"
```

to:
```
"sticky top-0 z-40 flex h-16 items-center justify-between bg-[var(--color-surface)]"
```

- [ ] **Step 3: Replace glass on search input**

Remove the `glass` class from the search input. The input already has `border` and focus styles, so just remove `glass` and ensure it has a proper background:

Replace `glass h-10 w-80 rounded-xl` with `h-10 w-80 rounded-xl bg-[var(--color-background)]`.

Also replace `focus:ring-2 focus:ring-[var(--color-accent-light)]` with `focus:ring-2 focus:ring-[var(--color-accent)]/15` (since accent-light is now an rgba value, use Tailwind opacity).

- [ ] **Step 4: Replace text-gradient on mobile title**

Change:
```
"text-base font-bold text-gradient md:hidden"
```

to:
```
"text-base font-bold text-[var(--color-text-primary)] md:hidden"
```

- [ ] **Step 5: Replace gradient on user avatar fallback**

If the top-bar has a user avatar fallback with `bg-gradient-to-br from-[var(--color-accent)] to-purple-600`, replace with `bg-[var(--color-accent)]` (same pattern as sidebar avatar in Task 11 Step 6).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/top-bar.tsx
git commit -m "feat: update top-bar — remove glass, theme toggle, gradients"
```

---

### Task 13: Update mobile-nav

**Files:**
- Modify: `src/components/layout/mobile-nav.tsx`

- [ ] **Step 1: Replace glass classes**

Read the file and replace all `glass` class references with `bg-[var(--color-surface)]`.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/mobile-nav.tsx
git commit -m "feat: update mobile-nav — remove glass"
```

---

## Chunk 4: Page File Updates

### Task 14: Update login page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace glass-card**

Change `glass-card rounded-3xl p-8` to `bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8`.

- [ ] **Step 2: Replace purple background orbs**

Change the decorative background from:
```
"fixed inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-purple-500/5 pointer-events-none"
```
to:
```
"fixed inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-transparent pointer-events-none"
```

Change the purple blur orb from `bg-purple-500/10` to `bg-[var(--color-accent)]/5`.

- [ ] **Step 3: Replace glow-pulse logo**

Change the fallback logo from:
```
"inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-purple-600 mb-4 shadow-[0_0_20px_var(--color-accent-glow)] animate-glow-pulse"
```

to:
```
"inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[var(--color-accent)] mb-4 shadow-sm"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "feat: update login page — remove glassmorphism and glow effects"
```

---

### Task 15: Update analytics page

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx`

- [ ] **Step 1: Replace all glass-card and gradient-border references**

This file has 12+ uses. Use find-and-replace across the file:

- Replace all `glass-card` with `bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm`
- Replace all `gradient-border` with `border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:shadow-md transition-all`
- Remove any `dark:` prefixed classes

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/analytics/page.tsx
git commit -m "feat: update analytics page — remove glass and gradient effects"
```

---

### Task 16: Batch update remaining pages with gradient-border and text-gradient

**Files:**
- Modify: `src/app/(dashboard)/my-profile/page.tsx`
- Modify: `src/app/(dashboard)/people/[id]/page.tsx`
- Modify: `src/app/(dashboard)/time-off/page.tsx`
- Modify: `src/app/(dashboard)/org/page.tsx`
- Modify: `src/app/(dashboard)/calendar/page.tsx`

- [ ] **Step 1: For each file, apply these replacements**

For all 5 files:
- Replace `gradient-border` with empty string (the Card component now handles hover)
- Replace `text-gradient` with `text-[var(--color-accent)]`
- Replace `glass-card` with `bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm`
- Remove any `dark:` prefixed classes

Note: Some of these files use `gradient-border` directly on divs (not via the Card component). For those, replace with `border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:shadow-md transition-all`.

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/my-profile/page.tsx src/app/(dashboard)/people/\\[id\\]/page.tsx src/app/(dashboard)/time-off/page.tsx src/app/(dashboard)/org/page.tsx src/app/(dashboard)/calendar/page.tsx
git commit -m "feat: update dashboard pages — remove gradients and glass"
```

---

### Task 17: Update reviews and welcome pages (purple gradients)

**Files:**
- Modify: `src/app/(dashboard)/reviews/page.tsx`
- Modify: `src/app/(dashboard)/welcome/page.tsx`

- [ ] **Step 1: Replace purple progress bar gradients**

In both files, replace any `to-purple-500` or `to-purple-600` gradient on progress bars with `bg-[var(--color-accent)]`.

For example, change:
```
bg-gradient-to-r from-[var(--color-accent)] to-purple-500
```
to:
```
bg-[var(--color-accent)]
```

Also replace any `gradient-border` as in Task 16.

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/reviews/page.tsx src/app/(dashboard)/welcome/page.tsx
git commit -m "feat: update reviews and welcome pages — remove purple gradients"
```

---

## Chunk 5: Feature Component Updates

### Task 18: Batch update feature components with gradient-border only

**Files:**
- Modify: `src/components/clubs/club-card.tsx`
- Modify: `src/components/people/employee-documents-section.tsx`
- Modify: `src/components/people/hr-notes-section.tsx`

- [ ] **Step 1: Replace gradient-border and purple gradients in all 3 files**

For each file, replace `gradient-border` with empty string if it's used alongside the Card component, or with `border border-[var(--color-border)] hover:border-[var(--color-accent)]/30 hover:shadow-md transition-all` if on a standalone div.

In `club-card.tsx`: also replace any `to-purple-600` or `to-purple-500` gradient with `bg-[var(--color-accent)]`.

- [ ] **Step 2: Commit**

```bash
git add src/components/clubs/club-card.tsx src/components/people/employee-documents-section.tsx src/components/people/hr-notes-section.tsx
git commit -m "feat: update club-card, docs section, hr-notes — remove gradient-border"
```

---

### Task 19: Update components with accent-glow

**Files:**
- Modify: `src/components/feed/post-composer.tsx`
- Modify: `src/components/people/add-employee-form.tsx`
- Modify: `src/components/cv/add-candidate-form.tsx`
- Modify: `src/components/org/department-actions.tsx`
- Modify: `src/components/settings/company-info.tsx`

- [ ] **Step 1: Remove accent-glow / glow-accent classes**

In each file, remove any `accent-glow`, `glow-accent`, or `shadow-[0_0_*_var(--color-accent-glow)]` inline shadow classes. Replace with `shadow-sm` if a shadow is still needed, or just remove.

- [ ] **Step 2: Commit**

```bash
git add src/components/feed/post-composer.tsx src/components/people/add-employee-form.tsx src/components/cv/add-candidate-form.tsx src/components/org/department-actions.tsx src/components/settings/company-info.tsx
git commit -m "feat: remove accent-glow from form and action components"
```

---

### Task 20: Update components with mixed patterns

**Files:**
- Modify: `src/components/analytics/ai-analytics-bar.tsx`
- Modify: `src/components/feed/post-card.tsx`
- Modify: `src/components/onboarding/onboarding-timeline.tsx`
- Modify: `src/components/people/people-list.tsx`
- Modify: `src/components/documents/document-signing-manager.tsx`

- [ ] **Step 1: ai-analytics-bar.tsx**

Replace `glass-card` with `bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm rounded-2xl`.
Replace `glow-accent` with `shadow-sm`.
Replace any `to-purple-600` or `to-purple-500` gradient patterns with `bg-[var(--color-accent)]`.

- [ ] **Step 2: post-card.tsx**

Replace `gradient-border` (see Task 18 pattern).
Replace `to-purple-500/10` decorative gradient with `bg-[var(--color-accent)]/5` or remove.

- [ ] **Step 3: onboarding-timeline.tsx**

Replace `gradient-border` (see Task 18 pattern).
Replace `to-purple-500` progress bar gradient with `bg-[var(--color-accent)]`.

- [ ] **Step 4: people-list.tsx**

Replace `gradient-border` (see Task 18 pattern).
Replace `accent-glow` / inline accent-glow shadow with `shadow-sm`.

- [ ] **Step 5: document-signing-manager.tsx**

Replace `glass-card` with `bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm rounded-2xl`.
Replace inline `shadow-[0_0_10px_var(--color-accent-glow)]` with `shadow-sm`.

- [ ] **Step 6: Commit**

```bash
git add src/components/analytics/ai-analytics-bar.tsx src/components/feed/post-card.tsx src/components/onboarding/onboarding-timeline.tsx src/components/people/people-list.tsx src/components/documents/document-signing-manager.tsx
git commit -m "feat: update mixed-pattern components — remove glass, gradients, glows"
```

---

## Chunk 6: Cleanup and Verification

### Task 21: Global search for remaining dark mode and removed classes

- [ ] **Step 1: Search for any remaining references**

```bash
cd /Users/baralezrah/hr-platform && grep -r "dark:" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
grep -r "glass-card\|glass\b\|gradient-border\|text-gradient\|glow-accent\|accent-glow\|animate-glow-pulse\|to-purple" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
grep -r "useTheme\|next-themes\|ThemeProvider" src/ --include="*.tsx" --include="*.ts" -l
grep -r "accent-glow\|color-accent-glow\|gradient-brand\|gradient-mesh" src/ --include="*.tsx" --include="*.ts" --include="*.css" -l
```

- [ ] **Step 2: Fix any remaining references found**

Known files with `dark:` classes not yet addressed:
- `src/components/settings/email-template-manager.tsx` — has `dark:text-emerald-400`, `dark:text-red-400`
- `src/components/cv/candidate-database.tsx` — has `dark:bg-[var(--color-background)]`
- `src/components/time-off/burnout-alerts.tsx` — has `dark:text-amber-400`
- `src/components/feed/post-card.tsx` — may have `dark:text-yellow-400`

For each file returned by grep:
- `dark:` classes → remove the dark: variant entirely
- Glass/gradient/glow classes → apply replacement rules from the spec
- `useTheme` / `next-themes` imports → remove
- `accent-glow` / `gradient-brand` CSS var references → replace per spec

- [ ] **Step 3: Commit if changes were made**

```bash
git add -A
git commit -m "feat: clean up remaining dark mode and removed class references"
```

---

### Task 22: Build verification

- [ ] **Step 1: Run the build**

```bash
cd /Users/baralezrah/hr-platform && npx next build
```

Expected: Build succeeds with no errors. Warnings about unused CSS classes are acceptable.

- [ ] **Step 2: Fix any build errors**

If there are TypeScript errors (e.g., missing ThemeProvider type, useTheme calls), fix them by removing the offending imports/usages.

- [ ] **Step 3: Start dev server and spot-check**

```bash
cd /Users/baralezrah/hr-platform && npx next dev
```

Open http://localhost:3000 and verify:
- Login page renders with white card, no glass effects
- Dashboard sidebar is solid white background
- Cards have soft shadows, no glow
- Buttons are solid blue (#3052FF), no purple gradient
- Page headers use accent blue text, no gradient text
- Headings use Aeonik font (check in browser dev tools)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: design system redesign complete — soft warm light-only theme"
```

- [ ] **Step 5: Push to deploy**

```bash
git push origin main
```
