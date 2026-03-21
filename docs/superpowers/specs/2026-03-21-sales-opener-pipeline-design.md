# Sales Opener Hire-to-Onboarding Pipeline — Design Spec

## Goal

Automate the Sales Opener hiring pipeline: when a candidate for the Sales Opener position is marked HIRED, automatically move them to pre-onboarding using their private email. Pre-onboarding acts as a trial phase — candidates either pass (get a work email and move to onboarding) or get rejected (receive a rejection email and are removed).

## Constraints

- Only applies to candidates whose position/job is "Sales Opener" (case-insensitive match)
- Private email (from candidate record) used throughout pre-onboarding — no work email yet
- Work email assigned only when passing pre-onboarding
- Rejection sends a template email to private email

---

## Flow

```
Candidate (Sales Opener) → status changed to HIRED
  ↓ (automatic)
Employee created with status PRE_ONBOARDING
  - email = candidate's private email
  - no work email / no user account yet
  - docs sent to private email
  ↓
Pre-onboarding phase (trial)
  ├─ PASS → enter work email → move to ONBOARDING (full employee)
  └─ FAIL → click Reject → send rejection email → status OFFBOARDED
```

---

## Changes

### 1. Auto-trigger hire on HIRED status (Sales Opener only)

**File:** `src/lib/actions/candidates.ts`

In the function that updates candidate status (likely `updateCandidateStatus` or similar), add logic:
- After setting status to `HIRED`, check if the candidate's position/jobAppliedTo matches "Sales Opener" (case-insensitive)
- If yes, automatically call `hireCandidateAndStartOnboarding()` with the candidate's private email as the employee email
- The hire function already handles pre-onboarding task resolution and sets status to `PRE_ONBOARDING` when pre-onboarding tasks exist

**Key detail:** The employee record should use the candidate's personal email (`candidate.email`), NOT a company email. Skip user account creation at this stage (no Google OAuth login needed during pre-onboarding trial).

### 2. Reject from pre-onboarding

**File:** `src/lib/actions/employees.ts`

New action: `rejectFromPreOnboarding(employeeId: string)`
- Requires ADMIN/HR role
- Fetch employee (must be in `PRE_ONBOARDING` status)
- Send rejection email to employee's email (private email) using the rejection template
- Update employee status to `OFFBOARDED`
- Delete any pending employee tasks
- Revalidate `/pre-onboarding` and `/people`

### 3. Rejection email template

**File:** `src/lib/email-template-defaults.ts`

Add default template for `PRE_ONBOARDING_REJECTION`:
- Subject: `Update regarding your position at {{companyName}}`
- Body: Professional rejection email thanking them for their time during the pre-onboarding period
- Variables: `{{firstName}}`, `{{companyName}}`, `{{logoUrl}}`

**File:** `prisma/schema.prisma`

If the `EmailTemplateType` enum is used, add `PRE_ONBOARDING_REJECTION`. Otherwise, store as a string type in the existing template system.

### 4. Work email on pre-onboarding completion

**File:** `src/components/onboarding/onboarding-timeline.tsx`

When the "Move to Onboarding" button is clicked for a pre-onboarding employee:
- Show a dialog/input asking for the employee's work email
- Pass the work email to `completePreOnboarding()`

**File:** `src/lib/actions/employees.ts`

Modify `completePreOnboarding(employeeId, workEmail?)`:
- If `workEmail` provided, update the employee's email to the work email
- Create a User account with the work email (for Google OAuth login)
- Send welcome email to the new work email
- Then proceed with normal onboarding task resolution

### 5. Reject button on pre-onboarding UI

**File:** `src/components/onboarding/onboarding-timeline.tsx`

Add a "Reject" button next to the "Move to Onboarding" button for pre-onboarding employees:
- Red/danger styled button
- Confirmation dialog: "Are you sure you want to reject this candidate? A rejection email will be sent."
- Calls `rejectFromPreOnboarding(employeeId)`

---

## File Summary

| Action | File |
|--------|------|
| Modify | `src/lib/actions/candidates.ts` (auto-trigger hire for Sales Opener) |
| Modify | `src/lib/actions/employees.ts` (add rejectFromPreOnboarding, modify completePreOnboarding for work email) |
| Modify | `src/components/onboarding/onboarding-timeline.tsx` (reject button + work email dialog) |
| Modify | `src/lib/email-template-defaults.ts` (rejection template) |
| Modify | `prisma/schema.prisma` (if enum needs updating for template type) |
