import { requireAuth } from "@/lib/auth-helpers";
import { GuidePrintButton } from "@/components/guide/guide-print-button";

export const metadata = {
  title: "User Guide · CALATRAVA",
};

export default async function GuidePage() {
  await requireAuth();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 guide-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .guide-root { max-width: 100% !important; padding: 0 !important; }
          h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
          section { break-inside: avoid; page-break-inside: avoid; }
          body { font-size: 11pt; }
          .role-pill { border: 1px solid #888 !important; background: #fff !important; color: #000 !important; }
        }
        .guide-prose h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 0.25rem; }
        .guide-prose h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.4rem; }
        .guide-prose h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.4rem; }
        .guide-prose p { margin-bottom: 0.6rem; line-height: 1.55; }
        .guide-prose ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.6rem; }
        .guide-prose ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.6rem; }
        .guide-prose li { margin-bottom: 0.25rem; line-height: 1.5; }
        .guide-prose code { background: var(--color-background); padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.9em; }
        .guide-prose table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
        .guide-prose th, .guide-prose td { border: 1px solid var(--color-border); padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
        .guide-prose th { background: var(--color-background); font-weight: 600; }
        .role-pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; background: var(--color-accent); color: white; margin-right: 0.25rem; }
      `}</style>

      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">Coastal Debt Resolve</p>
          <h1 className="text-3xl font-black">CALATRAVA — User Guide</h1>
        </div>
        <GuidePrintButton />
      </div>

      <div className="guide-prose text-[var(--color-text-primary)]">
        <section>
          <h1 className="hidden print:block">CALATRAVA — HR Platform User Guide</h1>
          <p className="text-[var(--color-text-muted)] mb-4">
            This guide covers how to navigate CALATRAVA, what each section does, and the most common workflows. Some pages are role-gated — your sidebar will only show what you can use.
          </p>
        </section>

        <section>
          <h2>1. Signing in & roles</h2>
          <p>Sign in with your <strong>@coastaldebt.com</strong> Google account. Anyone outside the domain is blocked. The system has five roles, each with a different view:</p>
          <table>
            <thead>
              <tr><th>Role</th><th>What they can do</th></tr>
            </thead>
            <tbody>
              <tr><td><span className="role-pill">SUPER_ADMIN</span></td><td>Everything. Only role that sees the Audit Log, Employee Archive, role-permissions matrix, and platform integrations.</td></tr>
              <tr><td><span className="role-pill">ADMIN</span></td><td>Same as Super Admin minus the items above. Manages people, recruitment, onboarding, settings.</td></tr>
              <tr><td><span className="role-pill">HR</span></td><td>People, recruitment, onboarding/offboarding, documents, reviews, settings.</td></tr>
              <tr><td><span className="role-pill">MANAGER</span></td><td>Their own profile, their direct reports, recruitment/pipeline view, 1:1s, reviews of direct reports.</td></tr>
              <tr><td><span className="role-pill">EMPLOYEE</span></td><td>Own profile, own documents, feed, clubs, calendar, time off, 1:1s with their manager.</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>2. Feed (home page)</h2>
          <p>Everyone lands here after signing in. Use it to post company-wide updates, give shoutouts to colleagues, attach images/GIFs, or create company events that show up on the Calendar.</p>
          <ul>
            <li><strong>Post</strong> — write text, attach a file or GIF, choose whether it sends a company-wide email.</li>
            <li><strong>Shoutout</strong> — tag a specific colleague; they get an in-app + email notification.</li>
            <li><strong>Event</strong> — adds a card to the Calendar with start/end/location.</li>
            <li><strong>React & comment</strong> — quick love/celebrate/like reactions; comments notify the post author.</li>
          </ul>
        </section>

        <section>
          <h2>3. People & Org</h2>
          <p>Manager+ only. Browse the company directory, click any colleague to see their profile.</p>
          <ul>
            <li><strong>Add Employee</strong> (HR+) — manual or bulk CSV import.</li>
            <li><strong>Profile pages</strong> show personal info, department, manager chain. HR Notes and HR_ONLY documents are admin-only. Emergency contact only renders to admin, the employee themselves, or their direct manager.</li>
            <li><strong>Archive</strong> (Super Admin only) — deleted employees are soft-deleted to <code>/people/archive</code>. They can be restored (optionally re-enabling their login) or permanently purged.</li>
          </ul>
        </section>

        <section>
          <h2>4. Recruitment (/cv)</h2>
          <p>The main hiring workspace. Two tabs:</p>
          <h3>Recruitment tab — Pipeline kanban</h3>
          <p>Each position is its own card with columns for every stage: New → Screening → Interview → Offer → BG Check → Pre-Onboarding → Onboarding → Hired (plus Rejected).</p>
          <ul>
            <li>Per-position <strong>search bar</strong> filters across all columns (name, email, phone, skill, source).</li>
            <li>Columns over 20 candidates show first 20 + "Show N more".</li>
            <li>Click a candidate card to open the full detail dialog.</li>
            <li>Hover a card → <strong>delete</strong> + <strong>→ next stage</strong> buttons appear.</li>
            <li><strong>Add Candidate</strong> on each position — pick an existing candidate from the database, or fill the New Candidate form. If the email already exists you'll see a friendly "already exists" alert.</li>
            <li><strong>Post Job</strong> button on a position opens the Job Boards panel: Careers Page, Breezy HR, Jobing. Clicking "Post to Breezy" is idempotent — it republishes the existing posting instead of creating a duplicate.</li>
          </ul>

          <h3>Candidate Database tab</h3>
          <p>The full searchable table of every candidate ever synced or added. Lazy-loaded — opens with a loading state, then renders all candidates.</p>
          <ul>
            <li>Bulk CSV import from Indeed or any spreadsheet.</li>
            <li>Bulk Resume Upload — drag in a folder of PDFs, the parser extracts name/email/phone/skills.</li>
            <li>AI candidate search — describe who you want; the system ranks candidates.</li>
            <li>Unite Duplicates — merges candidates with the same email.</li>
          </ul>
        </section>

        <section>
          <h2>5. Background checks</h2>
          <p>Provider: backgroundchecks.com (integrated). When you move a candidate to <strong>BG Check</strong> in the kanban, the candidate detail dialog opens with options:</p>
          <ul>
            <li><strong>Report tier</strong>: HIRE1 (basic) / HIRE2 / HIRE3.</li>
            <li>Optional checks: drug test, MVR, employment verification, education, federal/county criminal, bankruptcy, civil judgment, tax lien, credit report.</li>
            <li>Click <strong>Save</strong> in the dialog to actually send the order. The candidate's email gets the invite, status goes to "Awaiting Applicant" until they complete their form.</li>
          </ul>
          <p>Once the report is back: <strong>Refresh Status</strong> polls backgroundchecks.com. <strong>View Report</strong> opens the full PDF inside the platform. If a check is flagged, the system auto-sends an adverse-action letter and moves the candidate to Rejected (this is logged in the Audit Log).</p>
        </section>

        <section>
          <h2>6. Offer letters & signing</h2>
          <ol>
            <li>Move the candidate to <strong>Offer</strong>. The dialog lets you upload an offer PDF or generate one from a template.</li>
            <li>Click <strong>Send Offer</strong> — the candidate gets an email with a tokenized signing link.</li>
            <li>They sign in the browser (no account needed). Once signed, the system stores the signed PDF and marks the offer signed.</li>
            <li>You'll receive a notification. Then move to <strong>Hired</strong> → onboarding flow begins.</li>
          </ol>
        </section>

        <section>
          <h2>7. Onboarding / Pre-onboarding / Offboarding</h2>
          <p>HR+ only.</p>
          <ul>
            <li><strong>Pre-onboarding</strong> tasks fire when a department has any "PRE_ONBOARDING" checklist items configured (Sales Openers, etc.). Otherwise the candidate goes straight to Onboarding.</li>
            <li><strong>Onboarding</strong> assigns task lists per department + job-title overrides. Tasks can include documents to sign (e.g. NDA, W-4) that are sent automatically.</li>
            <li><strong>Offboarding</strong> ends the employee's login and assigns offboarding tasks. The Management group gets an email notification (configure in Settings → Notifications).</li>
          </ul>
        </section>

        <section>
          <h2>8. Documents</h2>
          <ul>
            <li><strong>Documents</strong> (sidebar) — admin/HR send documents for signing or filling. Managers see their direct reports' requests.</li>
            <li><strong>My Documents</strong> — every employee sees their own signed PDFs, pending signing tasks, etc.</li>
            <li><strong>Per-profile Documents section</strong> (on <code>/people/[id]</code>) — visible to the employee, their manager, and admin/HR. HR_ONLY uploads stay invisible to the employee themselves.</li>
          </ul>
          <p><strong>Signing flow</strong>: HR uploads a doc and clicks "Send for signing." Employee gets an email; they sign at <code>/sign/[token]</code> (no login). Filing flows the same way at <code>/fill/[token]</code> for PDFs with editable fields.</p>
        </section>

        <section>
          <h2>9. 1:1 Reviews</h2>
          <ul>
            <li>Managers schedule 1:1s with their direct reports. Two-tab notebook for shared notes during the meeting.</li>
            <li>Each 1:1 syncs to Google Calendar with a Meet link if Google Calendar is connected.</li>
            <li>Past 1:1 history is only visible to admin/HR, the employee, and their manager.</li>
          </ul>
        </section>

        <section>
          <h2>10. Performance reviews</h2>
          <p>Manager+ only. Anniversary reviews are auto-generated 14 days before an employee's work anniversary (via a daily cron). Each cycle has SELF + MANAGER reviews. Calendar shows your own + your reports' cycles.</p>
        </section>

        <section>
          <h2>11. Time off</h2>
          <ul>
            <li>Employee creates a request from their profile. Manager approves/denies.</li>
            <li>Self-approval is blocked.</li>
            <li>Approved time-off shows on the Calendar and on the "Who's Out" widget.</li>
            <li>Policies are configured in Settings (PTO days / unlimited / per-employee assignment).</li>
          </ul>
        </section>

        <section>
          <h2>12. Calendar</h2>
          <p>Aggregates: birthdays, work anniversaries, holidays, interviews (manager+), benefits eligibility (manager+), anniversary reviews (only your own + direct reports unless admin/HR), company events, and your personal Google Calendar (if connected).</p>
        </section>

        <section>
          <h2>13. Your Voice</h2>
          <p>Anonymous pulse survey. Admin sets a question, employees rate 1–5. Results are aggregated; individual responses are not shown.</p>
        </section>

        <section>
          <h2>14. Settings (admin/HR)</h2>
          <ul>
            <li><strong>Notification Settings</strong> — toggle which recipients (Candidate, Recruiter, Manager, HR Team, Management) get Email and/or In-App for each action. The two configurable groups (HR Team, Management) accept any employee.</li>
            <li><strong>Email Templates</strong> — preview and override the wording of welcome, signing-request, stage-change, offer, adverse-action, etc.</li>
            <li><strong>Pipeline Stages</strong> — rename, recolor, reorder, or hide stages on the kanban.</li>
            <li><strong>Departments / Teams / Job Titles</strong> — org structure.</li>
            <li><strong>Onboarding / Offboarding setup</strong> — checklists per department + job-title override + per-task email/document/assignee.</li>
            <li><strong>Stage documents</strong> — upload PDFs that auto-attach when a candidate hits Hired/Pre-onboarding/Onboarding stages.</li>
            <li><strong>Recruitment Platforms</strong> — connect Breezy HR, Jobing, LinkedIn Recruiter, etc. Breezy auto-syncs every 5 minutes (configurable).</li>
            <li><strong>Roles & Permissions</strong> (SUPER_ADMIN) — toggle which features each role can access.</li>
            <li><strong>Users</strong> — invite, reset passwords, change roles. Admins cannot manage Super Admin accounts.</li>
          </ul>
        </section>

        <section>
          <h2>15. Integrations</h2>
          <table>
            <thead><tr><th>Service</th><th>What it does</th></tr></thead>
            <tbody>
              <tr><td>Breezy HR</td><td>Sources candidates from Indeed/LinkedIn/ZipRecruiter/etc., posts our positions back. Cron polls every 5 min for new applicants and downloads their resume PDFs locally.</td></tr>
              <tr><td>backgroundchecks.com</td><td>Initiates checks, polls status, fetches the report PDF for in-platform review.</td></tr>
              <tr><td>Google Calendar</td><td>Syncs interviews + 1:1s to attendees' personal calendars with Meet links.</td></tr>
              <tr><td>Gusto</td><td>Pulls employee + payroll info into the People tab.</td></tr>
              <tr><td>Resend (email)</td><td>Sends every transactional email from <code>hrteam@hr.coastaldebt-tools.com</code>.</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>16. Audit Log (SUPER_ADMIN)</h2>
          <p>Sidebar → Audit Log. Captures who did what, when, against which entity. Filterable by action / actor email / entity type. Covered events:</p>
          <ul>
            <li><code>auth.login</code></li>
            <li><code>user.invited</code> / <code>user.role.changed</code> / <code>user.password.set</code> / <code>user.deleted</code></li>
            <li><code>employee.created</code> / <code>updated</code> / <code>promoted</code> / <code>offboarding_started</code> / <code>archived</code> / <code>restored</code> / <code>purged</code></li>
            <li><code>candidate.status.changed</code> (including the via field — kanban move, adverse-action letter, or mark-do-not-call) / <code>candidate.deleted</code></li>
            <li><code>position.status.changed</code> / <code>position.posted_to_breezy</code></li>
          </ul>
        </section>

        <section>
          <h2>17. Privacy & visibility rules</h2>
          <ul>
            <li>Employees cannot view other employees' profiles — only their own. Manager role adds direct-report visibility. HR+ sees everyone.</li>
            <li>HR_ONLY documents are filtered out of <code>/my-documents</code> and the employee's own profile. The blob-serving route also rejects unauthorized fetches.</li>
            <li>HR Notes are admin/HR-only end to end.</li>
            <li>Anniversary reviews on the Calendar are scoped: admin/HR see all, manager sees own + direct reports, everyone else sees only their own.</li>
          </ul>
        </section>

        <section>
          <h2>18. Common tasks — step by step</h2>

          <h3>Post a new position to Breezy + the careers page</h3>
          <ol>
            <li>Recruitment → Add Position. Fill title, salary, location, description, requirements.</li>
            <li>Save. The position card appears.</li>
            <li>Click "Post to Breezy" — Breezy publishes it and we record the link.</li>
            <li>The careers page (<code>/careers</code>) automatically lists any published position.</li>
          </ol>

          <h3>Hire a candidate</h3>
          <ol>
            <li>Move them through the kanban to <strong>Offer</strong> → upload the offer PDF.</li>
            <li>Send the signing link; wait for them to sign.</li>
            <li>Move to <strong>BG Check</strong> → configure checks → Save. Wait for status to become PASSED.</li>
            <li>Click <strong>Move to Hired</strong>. The detail dialog asks for a company email + start date; the system creates the Employee record and either kicks off Pre-onboarding (if configured for that role) or Onboarding directly.</li>
          </ol>

          <h3>Send a contract for signing</h3>
          <ol>
            <li>Documents page → New Document. Upload PDF, mark "Requires signature."</li>
            <li>Pick the recipient employee. Save.</li>
            <li>Employee gets an email with a signing link. Once signed, you'll get a notification and the signed PDF is filed against their profile.</li>
          </ol>

          <h3>Offboard an employee</h3>
          <ol>
            <li>People → click the employee → "Start Offboarding."</li>
            <li>Pick their last day. The system creates offboarding tasks and emails the Management group.</li>
            <li>The employee's login is revoked immediately.</li>
          </ol>
        </section>

        <section>
          <h2>19. Troubleshooting</h2>
          <ul>
            <li><strong>"Already exists" alert when adding a candidate</strong> — that email is in the database. Switch to the "From Database" tab and reassign them to the position.</li>
            <li><strong>Resume PDF returns 403</strong> — the Breezy integration user lacks resume-download permission on that role. Have a Breezy admin grant it, or reconnect using an admin Breezy account.</li>
            <li><strong>Position duplicated on Breezy</strong> — was a known bug; fixed. If you have older duplicates, delete them directly in the Breezy dashboard.</li>
            <li><strong>Candidate's <em>via</em> source shows "applied"</strong> — pre-fix data. Will self-correct on the next cron sync.</li>
            <li><strong>Sync isn't running</strong> — check the Railway cron service (<code>hr-cron-sync</code>) is Active and runs every 5 min.</li>
          </ul>
        </section>

        <section>
          <p className="text-xs text-[var(--color-text-muted)] mt-8 pt-4 border-t border-[var(--color-border)]">
            Last updated: built into the codebase. For platform changes, check the audit log or ask the engineering team.
          </p>
        </section>
      </div>
    </div>
  );
}
