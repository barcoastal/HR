import { requireAuth } from "@/lib/auth-helpers";
import { GuidePrintButton } from "@/components/guide/guide-print-button";

export const metadata = { title: "User Guide · CALATRAVA" };

function GuideImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="my-4 border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-background)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full block" />
      {caption && (
        <figcaption className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export default async function GuidePage() {
  await requireAuth();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 guide-root">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .guide-root { max-width: 100% !important; padding: 0 !important; }
          h1, h2, h3 { break-after: avoid; page-break-after: avoid; }
          section, figure { break-inside: avoid; page-break-inside: avoid; }
          body { font-size: 11pt; }
          .role-pill { border: 1px solid #888 !important; background: #fff !important; color: #000 !important; }
          figure { max-width: 100%; }
          figure img { max-height: 4.5in; object-fit: contain; }
        }
        .guide-prose h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 0.25rem; }
        .guide-prose h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.4rem; }
        .guide-prose h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .guide-prose h4 { font-size: 1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.4rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.8rem; }
        .guide-prose p { margin-bottom: 0.7rem; line-height: 1.6; }
        .guide-prose ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.7rem; }
        .guide-prose ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.7rem; }
        .guide-prose li { margin-bottom: 0.3rem; line-height: 1.55; }
        .guide-prose li li { margin-bottom: 0.2rem; }
        .guide-prose code { background: var(--color-background); padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
        .guide-prose table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; font-size: 0.9rem; }
        .guide-prose th, .guide-prose td { border: 1px solid var(--color-border); padding: 0.45rem 0.7rem; text-align: left; vertical-align: top; }
        .guide-prose th { background: var(--color-background); font-weight: 600; }
        .role-pill { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; background: var(--color-accent); color: white; margin-right: 0.25rem; }
        .callout { background: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); border-left: 3px solid var(--color-accent); padding: 0.7rem 0.9rem; border-radius: 6px; margin: 0.8rem 0; font-size: 0.95rem; }
        .callout strong { color: var(--color-accent); }
        .toc { background: var(--color-background); border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
        .toc ol { column-count: 2; column-gap: 1.5rem; margin: 0; }
        @media (max-width: 700px) { .toc ol { column-count: 1; } }
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
            Step-by-step walkthroughs for every page, with screenshots of the live platform. Some sections are role-gated — your sidebar will only show what you have access to.
          </p>

          <div className="toc">
            <h4>Contents</h4>
            <ol>
              <li>Signing in &amp; roles</li>
              <li>Feed (home)</li>
              <li>People &amp; profiles</li>
              <li>My Profile</li>
              <li>Recruitment pipeline</li>
              <li>Adding a candidate</li>
              <li>Moving through stages</li>
              <li>Background checks</li>
              <li>Offer letters &amp; signing</li>
              <li>Hiring &amp; onboarding</li>
              <li>Offboarding</li>
              <li>Documents &amp; signing</li>
              <li>My Documents</li>
              <li>Calendar</li>
              <li>1:1 reviews</li>
              <li>Performance reviews</li>
              <li>Time off</li>
              <li>Your Voice (pulse)</li>
              <li>Clubs</li>
              <li>Settings</li>
              <li>Notifications</li>
              <li>Audit Log</li>
              <li>Privacy &amp; visibility</li>
              <li>Integrations</li>
              <li>Troubleshooting</li>
            </ol>
          </div>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>1. Signing in &amp; roles</h2>
          <ol>
            <li>Go to <code>hr.coastaldebt-tools.com</code>.</li>
            <li>Click <strong>Sign in with Google</strong> and use your <code>@coastaldebt.com</code> account. The system rejects anyone outside the domain.</li>
            <li>You&apos;ll land on the Feed.</li>
          </ol>

          <h3>The five roles</h3>
          <table>
            <thead><tr><th>Role</th><th>What they see &amp; can do</th></tr></thead>
            <tbody>
              <tr><td><span className="role-pill">SUPER_ADMIN</span></td><td>Everything. Only role that sees Audit Log, Employee Archive, Roles &amp; Permissions, full platform integrations panel.</td></tr>
              <tr><td><span className="role-pill">ADMIN</span></td><td>Same as Super Admin minus the items above. Manages people, recruitment, onboarding, settings.</td></tr>
              <tr><td><span className="role-pill">HR</span></td><td>People, recruitment, onboarding/offboarding, documents, reviews, settings (most of it).</td></tr>
              <tr><td><span className="role-pill">MANAGER</span></td><td>Own profile, direct reports&apos; profiles, the recruitment pipeline, 1:1s, reviews of direct reports, the company directory.</td></tr>
              <tr><td><span className="role-pill">EMPLOYEE</span></td><td>Own profile, own documents, feed, clubs, calendar, time off, 1:1s with their manager. Cannot browse colleagues.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>2. Feed — the homepage</h2>
          <p>The Feed is where the company talks. Everyone lands here after signing in.</p>
          <GuideImage src="/guide/01-feed.png" alt="Feed homepage" caption="Feed — posts, shoutouts, events, and reactions" />

          <h4>Posting an update</h4>
          <ol>
            <li>Type into the &quot;What&apos;s on your mind?&quot; box.</li>
            <li>Optionally attach: <strong>Photo</strong>, file (<strong>Attach</strong>), or a <strong>GIF</strong> from the Giphy picker.</li>
            <li>The <strong>Email all</strong> toggle (on by default) sends every active employee a notification email when you post. Untick to keep it in-app only.</li>
            <li>Click <strong>Post</strong>.</li>
          </ol>

          <h4>Shoutouts</h4>
          <p>Click <strong>Shoutout</strong>, pick a colleague, write your message. They get a personal email + an in-app notification on top of the regular post visibility.</p>

          <h4>Company events</h4>
          <p>Click <strong>Event</strong>, set start/end date and location. The event renders in the Feed and on the Calendar for everyone.</p>

          <h4>Reactions &amp; comments</h4>
          <p>Hover any post to react (love / celebrate / like) or click the speech bubble to comment. The post author gets notified — they can configure which notifications they want in <strong>My Profile → Notifications</strong>.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>3. People &amp; profiles</h2>
          <p>Manager+ only. The directory of everyone in the company.</p>
          <GuideImage src="/guide/05-people.png" alt="People list" caption="People — pending invites, active employees, filters" />

          <h4>Adding an employee</h4>
          <ol>
            <li>Click <strong>Add Employee</strong> (top right).</li>
            <li>Fill the form: name, email, job title, department, manager, start date, etc.</li>
            <li>Save. They&apos;ll show up under <strong>Pending Employees</strong> at the top of /people until you click <strong>Approve</strong> — that sends them a Google-sign-in invite.</li>
          </ol>

          <h4>Bulk import</h4>
          <ol>
            <li>Click <strong>Bulk Import</strong> → drop a CSV with first name, last name, email, job title, department, manager, start date columns.</li>
            <li>Review the preview, then confirm. Rows missing required fields are listed as errors.</li>
          </ol>

          <h4>Archive</h4>
          <p>SUPER_ADMIN only. The <strong>Archive</strong> button (top right) goes to <code>/people/archive</code>. Deleted employees aren&apos;t actually deleted — they&apos;re moved here. You can:</p>
          <ul>
            <li><strong>Restore</strong> — un-archive. You&apos;ll be asked whether to also re-enable their login.</li>
            <li><strong>Delete permanently</strong> — true hard delete, irreversible. Logged in the Audit Log.</li>
          </ul>

          <div className="callout">
            <strong>Privacy:</strong> Employees can&apos;t click on each other&apos;s profiles. Managers see only their direct reports. HR &amp; admins see everyone. Emergency contact and HR_ONLY documents only show to the employee themselves, their direct manager, and admin/HR.
          </div>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>4. My Profile</h2>
          <GuideImage src="/guide/09-my-profile.png" alt="My Profile" caption="Your own profile — documents widget, club memberships, personal info" />

          <h4>What you control here</h4>
          <ul>
            <li><strong>About</strong> — bio, hobbies, dietary restrictions (used by event planning).</li>
            <li><strong>Personal Info</strong> — address, pronouns, T-shirt size. Notably you cannot change your job title or department here — only HR can.</li>
            <li><strong>Emergency Contact</strong> — name, phone, relationship. Visible only to you, your direct manager, and admin/HR.</li>
            <li><strong>Notifications</strong> (scroll down) — per-category toggles for in-app and email: feed posts, comments, shoutouts, reactions, events, etc.</li>
            <li><strong>Profile photo</strong> — click your avatar to upload.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>5. Recruitment pipeline</h2>
          <p>Manager+ only. <code>/cv</code>. The heart of hiring.</p>
          <GuideImage src="/guide/02-cv-pipeline.png" alt="Recruitment overview" caption="Recruitment — top stats, AI search, positions list" />

          <h4>The stats row</h4>
          <ul>
            <li><strong>Open Positions</strong> — positions with status OPEN.</li>
            <li><strong>Active in Pipeline</strong> — candidates that aren&apos;t HIRED or REJECTED.</li>
            <li><strong>Total Candidates</strong> — every candidate ever added or synced.</li>
            <li><strong>Archived Positions</strong> — closed/filled positions (expandable section further down the page).</li>
          </ul>

          <h4>AI candidate search</h4>
          <p>Type free text (e.g. <em>&quot;closer with 5+ years in debt relief&quot;</em>). The AI tab uses GPT to rank candidates by skill/experience match. The Keyword tab is a literal substring search across name, email, resume text, skills.</p>

          <h4>The pipeline kanban (per position)</h4>
          <GuideImage src="/guide/03-cv-kanban.png" alt="Pipeline kanban" caption="Per-position kanban with search bar and compact candidate cards" />
          <ul>
            <li>Each position is its own card. Click the row to expand it.</li>
            <li><strong>Search bar</strong> at the top filters across every column in <em>that position</em>. Searches name, email, phone, skill, source, experience, notes.</li>
            <li>Columns over 20 candidates show the first 20 with a <strong>&quot;Show N more&quot;</strong> button.</li>
            <li>Click a candidate card to open the full detail dialog.</li>
            <li>Hover a card → delete + <strong>→</strong> (move to next stage) buttons appear.</li>
          </ul>

          <h4>Job boards panel</h4>
          <p>Click <strong>Job boards</strong> at the top of a position to see where it&apos;s posted (Careers, Breezy, Jobing). Toggle posting on each board independently. <strong>Post to Breezy</strong> is idempotent — it republishes the existing posting instead of duplicating.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>6. Adding a candidate to a position</h2>
          <ol>
            <li>On the position row, click <strong>Add Candidate</strong>.</li>
            <li>Pick your <strong>Recruiter</strong> from the dropdown (the recruiter gets emailed when they&apos;re assigned).</li>
            <li>Two tabs:
              <ul>
                <li><strong>From Database</strong> — search existing candidates by name/email, click <strong>Add</strong> to assign them to this position.</li>
                <li><strong>New Candidate</strong> — first/last name, email, phone, skills (comma-separated).</li>
              </ul>
            </li>
            <li>Click <strong>Add Candidate</strong>.</li>
          </ol>
          <div className="callout">
            <strong>Duplicate email?</strong> If the email already exists in the database, you&apos;ll get an alert: <em>&quot;A candidate with email X already exists.&quot;</em> Switch to the From Database tab and reassign instead of creating a duplicate.
          </div>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>7. Moving a candidate through stages</h2>
          <p>Three ways:</p>
          <ol>
            <li>Hover the card → click the <strong>→</strong> button (advances to the next stage).</li>
            <li>Click the card → in the detail dialog, change the <strong>Status</strong> dropdown → Save.</li>
            <li>Drag-and-drop between columns (where supported by your browser).</li>
          </ol>
          <p>Every move writes a row to the Audit Log with actor, from-stage, to-stage, and timestamp. The configured notification recipients (HR Team, recruiter, manager — configurable in Settings) get an email + in-app notification.</p>

          <h4>Special stage transitions</h4>
          <ul>
            <li><strong>BACKGROUND_CHECK</strong> — clicking <strong>→</strong> opens the detail dialog with the BG-check options. You must click Save inside the dialog to actually order the check.</li>
            <li><strong>HIRED</strong> — opens the detail dialog so you can supply the company email + start date. Triggers the onboarding flow.</li>
            <li><strong>REJECTED</strong> — set explicitly via the dropdown, OR side-effect of clicking <strong>Mark Do Not Call</strong>, OR side-effect of <strong>Send Adverse Action Letter</strong>. All three paths are audited.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>8. Background checks</h2>
          <p>Provider: backgroundchecks.com (integrated).</p>
          <ol>
            <li>Move the candidate to BG Check (via card → button or detail dialog). The dialog opens.</li>
            <li>In the <strong>Background Check Options</strong> section, pick:
              <ul>
                <li><strong>Report tier</strong>: HIRE1 (basic) / HIRE2 (mid) / HIRE3 (deep).</li>
                <li><strong>Drug test</strong> on/off + panel type (5/9/10).</li>
                <li>Optional checks: MVR, employment verification, education, federal &amp; county criminal, bankruptcy, civil judgment, tax lien, credit report.</li>
              </ul>
            </li>
            <li>Click <strong>Save</strong>. The system posts the order to backgroundchecks.com and emails the candidate an applicant invite link.</li>
          </ol>

          <h4>Tracking the report</h4>
          <ul>
            <li>The candidate&apos;s detail dialog shows a colored status pill: <em>Awaiting Applicant → Processing → Passed/Flagged</em>.</li>
            <li>Click <strong>Refresh Status</strong> to poll backgroundchecks.com.</li>
            <li>Click <strong>View Report</strong> (purple button) to open the full PDF inside the platform.</li>
            <li>If flagged, the system auto-sends an <strong>adverse action letter</strong> to the candidate and moves them to REJECTED. You can also send it manually from the dialog.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>9. Offer letters &amp; signing</h2>
          <ol>
            <li>Move the candidate to the <strong>Offer</strong> stage.</li>
            <li>In the detail dialog, upload the offer PDF.</li>
            <li>Click <strong>Send Offer</strong>. The candidate receives an email with a tokenized link to <code>/sign/[token]</code>.</li>
            <li>They open the link in any browser (no login required), draw or type their signature, and submit.</li>
            <li>The signed PDF is saved against their record. You get an in-app + email notification.</li>
            <li>Move them to <strong>Hired</strong> when ready.</li>
          </ol>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>10. Hiring → Onboarding</h2>
          <p>HR+ only. Moving a candidate to <strong>Hired</strong> kicks off onboarding automatically:</p>
          <ol>
            <li>The detail dialog prompts for: <strong>Company email</strong>, <strong>Start date</strong>, optionally a <strong>Manager</strong> override.</li>
            <li>An Employee row is created with status <code>ONBOARDING</code> (or <code>PRE_ONBOARDING</code> if their department + job title has pre-onboarding tasks configured).</li>
            <li>The Welcome email goes out. They&apos;ll see the <strong>Pre-Onboarding</strong> page when they log in.</li>
            <li>HR sees them on <strong>/pre-onboarding</strong> and <strong>/onboarding</strong> with their task list.</li>
            <li>When all onboarding tasks are complete, click <strong>Move to Active</strong> on the employee — they become a regular team member.</li>
          </ol>

          <div className="callout">
            <strong>Configuring onboarding tasks:</strong> Settings → Onboarding Setup. Add checklist tasks per department, with optional job-title overrides for specific roles. Each task can include a document to sign, an email to fire, or an assignee (e.g. IT, Finance).
          </div>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>11. Offboarding</h2>
          <p>HR+ only.</p>
          <ol>
            <li>People → click the employee → scroll to <strong>Start Offboarding</strong>.</li>
            <li>Pick their last day.</li>
            <li>Save. The system:
              <ul>
                <li>Sets employee status to OFFBOARDED.</li>
                <li>Revokes their login immediately (their User row is deleted).</li>
                <li>Creates offboarding tasks per the configured offboarding checklist.</li>
                <li>Emails the Management group (configurable in Settings → Notification Settings).</li>
              </ul>
            </li>
          </ol>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>12. Documents &amp; signing</h2>
          <p>Sidebar → <strong>Documents</strong> (admin/HR/manager). The hub for everything signature-related.</p>
          <GuideImage src="/guide/07-documents.png" alt="Documents page" caption="Documents — Send for Signing, track Pending / Signed / Voided" />

          <h4>Sending a document for signing</h4>
          <ol>
            <li>Click <strong>Send for Signing</strong> (top right).</li>
            <li>Pick the recipient employee (or candidate).</li>
            <li>Upload the PDF, give it a name.</li>
            <li>Optionally place signature fields on specific pages by clicking on the preview.</li>
            <li>Optionally pick a <strong>Countersigner</strong> (a second employee who must sign after the first).</li>
            <li>Click <strong>Send</strong>.</li>
          </ol>

          <h4>Sending a fillable PDF (form fields)</h4>
          <p>Same flow, but click <strong>Send for Filling</strong>. The recipient gets a link to fill in text fields, dates, and signatures, then submits.</p>

          <h4>Status tracking</h4>
          <ul>
            <li><strong>Pending</strong> — sent, not yet viewed.</li>
            <li><strong>Viewed</strong> — recipient opened it.</li>
            <li><strong>Awaiting Countersign</strong> — primary signed, waiting on countersigner.</li>
            <li><strong>Signed</strong> — fully complete. Click the row to download the signed PDF.</li>
            <li><strong>Voided</strong> — cancelled.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>13. My Documents</h2>
          <p>Every employee&apos;s personal docs hub.</p>
          <GuideImage src="/guide/10-my-documents.png" alt="My Documents" caption="My Documents — every file on file for you and anything pending your signature" />
          <ul>
            <li><strong>Waiting for you</strong> badge — open the link, sign, done.</li>
            <li><strong>Signed</strong> — fully completed; download the PDF anytime.</li>
            <li><strong>On file</strong> — uploaded by HR (offer letter, W-4, etc.), already complete.</li>
            <li><strong>Awaiting countersign</strong> — you signed; waiting on HR or manager to countersign.</li>
          </ul>
          <p>HR_ONLY documents do <em>not</em> show here — even if they&apos;re tagged to you.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>14. Calendar</h2>
          <GuideImage src="/guide/04-calendar.png" alt="Calendar" caption="Calendar — birthdays, anniversaries, holidays, interviews, events, your own Google Calendar" />

          <h4>What shows on the calendar</h4>
          <ul>
            <li><strong>Birthdays &amp; work anniversaries</strong> (public to all).</li>
            <li><strong>Holidays</strong> — Jewish, Muslim, Christian, US federal (categorized by color).</li>
            <li><strong>Interviews</strong> (manager+ only) — scheduled interviews with their Meet links.</li>
            <li><strong>Benefits eligibility dates</strong> (manager+ only).</li>
            <li><strong>Anniversary review cycles</strong> — scoped per role: admin/HR see all, manager sees own + direct reports, employee sees only their own.</li>
            <li><strong>Company events</strong> (from Feed event posts).</li>
            <li><strong>Your personal Google Calendar</strong> — only if you connected it under Settings.</li>
          </ul>

          <h4>Creating a calendar event</h4>
          <p>Manager+ → <strong>Create Event</strong> button. Set title, start, end, location, optionally restrict to specific departments. Posts to the Feed too.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>15. 1:1 reviews</h2>
          <p>Sidebar → <strong>1:1 Reviews</strong>. Managers schedule recurring 1:1s with their direct reports.</p>
          <ol>
            <li>Click <strong>Schedule 1:1</strong> → pick employee → set date &amp; time.</li>
            <li>If Google Calendar is connected, a Meet event is created on both calendars automatically.</li>
            <li>During the meeting open the notebook tab — both manager and employee can co-edit notes live.</li>
            <li>Mark Complete to archive it. Past 1:1 history is visible only to admin/HR, the employee, and their manager.</li>
          </ol>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>16. Performance reviews</h2>
          <p>Manager+ only. Sidebar → <strong>Reviews</strong>.</p>
          <ul>
            <li><strong>Anniversary reviews</strong> are auto-generated 14 days before an employee&apos;s work anniversary via a daily cron job. Each cycle has a SELF review + a MANAGER review.</li>
            <li>Both reviewer and employee get email notifications.</li>
            <li>Open the cycle to fill out the template; click <strong>Submit</strong>.</li>
            <li>Templates can be customized per department in Settings.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>17. Time off</h2>
          <p>Every employee can request PTO from their My Profile page or the Time Off tab.</p>
          <ol>
            <li>Pick the policy (e.g. Vacation, Sick, Personal).</li>
            <li>Pick start &amp; end dates.</li>
            <li>Optionally add a reason.</li>
            <li>Submit. Your manager + HR get notified.</li>
          </ol>
          <p>Managers approve/deny from the <strong>Pending Requests</strong> tab. Approved time-off shows on the Calendar and on the &quot;Who&apos;s Out Today&quot; widget. Self-approval is blocked.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>18. Your Voice (anonymous pulse)</h2>
          <p>Sidebar → <strong>Your Voice</strong>. Admin creates a pulse question; employees rate it 1–5. Individual responses are aggregated and not attributable to the responder. Results render as average mood + distribution chart in Settings → Pulse Surveys.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>19. Clubs</h2>
          <p>Lightweight social groups (Soccer, Book Club, etc.). Anyone can create a club, invite members, post inside the club&apos;s mini-feed. Club memberships show on your profile.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>20. Settings</h2>
          <p>Admin+ only.</p>
          <GuideImage src="/guide/06-settings.png" alt="Settings page" caption="Settings — Company Information at the top" />

          <h4>Sections (scroll down through these)</h4>
          <ul>
            <li><strong>Company Information</strong> — name, logo, favicon, sender email/name for outbound mail.</li>
            <li><strong>User Management</strong> — invite new users, reset passwords, change roles, delete users. Admins cannot manage Super Admin accounts.</li>
            <li><strong>Departments &amp; Teams</strong> — org structure.</li>
            <li><strong>Job Titles</strong> — the canonical list used in employee profiles.</li>
            <li><strong>Pipeline Stages</strong> — rename, recolor, reorder, or hide stages on the recruitment kanban.</li>
            <li><strong>Onboarding / Pre-Onboarding / Offboarding Setup</strong> — checklists per department + job-title overrides + per-task email/document/assignee.</li>
            <li><strong>Stage Documents</strong> — PDFs that auto-attach when a candidate hits Hired / Pre-onboarding / Onboarding stages.</li>
            <li><strong>Email Templates</strong> — preview and override the wording of welcome, signing-request, stage-change, offer, adverse-action emails.</li>
            <li><strong>Recruitment Platforms</strong> — connect Breezy HR, Jobing, LinkedIn Recruiter, Indeed (via Unified.to), Google Calendar, Gusto.</li>
            <li><strong>Time-Off Policies</strong> — define PTO policies, assign to employees.</li>
            <li><strong>Pulse Surveys</strong> — create + view past pulse questions.</li>
            <li><strong>Notification Settings</strong> — see the next section.</li>
            <li><strong>Roles &amp; Permissions</strong> (SUPER_ADMIN only) — toggle which features each role can use.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>21. Notifications</h2>
          <p>Settings → <strong>Notification Settings</strong>.</p>
          <ul>
            <li>The matrix is <strong>Action × Recipient × Channel</strong>. Tick a box to enable a notification.</li>
            <li>Five recipients: <strong>Candidate</strong> (email only — no in-app since they don&apos;t have accounts), <strong>Recruiter</strong> (the candidate&apos;s assigned recruiter), <strong>Manager</strong>, <strong>HR Team</strong>, <strong>Management</strong>.</li>
            <li>The two configurable groups at the bottom: <strong>HR Team Recipients</strong> and <strong>Management Recipients</strong>. Add employees by typing their name in the search box. Anyone in these groups receives every notification where the corresponding column is enabled.</li>
            <li>Actions today: Candidate Stage Change, Offer Letter Sent, Offer Signed, Document Sign Request, Document Signed, Interview Scheduled, New Hire / Onboarding, Task Assigned, Onboarding Completed, Employee Offboarding Started, Recruiter Assigned to Candidate.</li>
          </ul>
          <p>Click <strong>Save</strong> after toggling. Changes apply on the next event fired.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>22. Audit Log</h2>
          <p>SUPER_ADMIN only. Sidebar → <strong>Audit Log</strong>.</p>
          <GuideImage src="/guide/08-audit-log.png" alt="Audit Log" caption="Audit Log — filter by action, actor email, or entity type" />

          <h4>What gets logged</h4>
          <ul>
            <li><code>auth.login</code> — every sign-in (provider, userId).</li>
            <li><code>user.invited</code>, <code>user.role.changed</code>, <code>user.password.set</code>, <code>user.deleted</code>.</li>
            <li><code>employee.created</code> / <code>updated</code> / <code>promoted</code> / <code>offboarding_started</code> / <code>archived</code> / <code>restored</code> / <code>purged</code>.</li>
            <li><code>candidate.status.changed</code> (with <em>from</em>/<em>to</em> + <em>via</em>: kanban move / adverse-action letter / mark-do-not-call) and <code>candidate.deleted</code>.</li>
            <li><code>position.status.changed</code> and <code>position.posted_to_breezy</code>.</li>
          </ul>
          <p>Use the filters at the top to drill in by action, actor email, or entity type. Each row shows: timestamp, actor (email + role), action name, target entity (type + ID), and a JSON details blob with relevant context.</p>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>23. Privacy &amp; visibility rules</h2>
          <ul>
            <li>Employees cannot view other employees&apos; profiles — only their own.</li>
            <li>Managers add visibility into their direct reports&apos; profiles.</li>
            <li>HR+ sees everyone.</li>
            <li>HR_ONLY documents are filtered out of My Documents and the employee&apos;s own profile widget. The file-serving route also rejects unauthorized fetches.</li>
            <li>HR Notes are admin/HR-only end to end.</li>
            <li>Anniversary review events on the Calendar are scoped to admin/HR (all), manager (own + reports), employee (own only).</li>
            <li>Emergency contact only renders to admin, the employee, or their direct manager.</li>
            <li>1:1 notebook history only visible to admin/HR, the employee, and their manager.</li>
            <li>Pulse responses are anonymous — only aggregates are exposed.</li>
          </ul>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>24. Integrations</h2>
          <table>
            <thead><tr><th>Service</th><th>What it does &amp; how to connect</th></tr></thead>
            <tbody>
              <tr><td><strong>Breezy HR</strong></td><td>Sources candidates from Indeed / LinkedIn / ZipRecruiter / etc. Posts our positions back. Cron polls every 5 minutes for new applicants and downloads their resume PDFs locally. Connect at Settings → Recruitment Platforms → Breezy HR (email + password).</td></tr>
              <tr><td><strong>backgroundchecks.com</strong></td><td>Initiates checks, polls status, fetches the report PDF for in-platform review. Configured via the <code>BACKGROUND_CHECK_API_KEY</code> environment variable.</td></tr>
              <tr><td><strong>Google Calendar</strong></td><td>Syncs interviews + 1:1s to attendees&apos; personal calendars with Meet links. Connect under Settings → Recruitment Platforms → Google Calendar (OAuth).</td></tr>
              <tr><td><strong>Gusto</strong></td><td>Pulls employee + payroll info into the People tab. Connect under Settings → Gusto.</td></tr>
              <tr><td><strong>Resend (email)</strong></td><td>Sends every transactional email from <code>hrteam@hr.coastaldebt-tools.com</code>. Configured via env vars.</td></tr>
              <tr><td><strong>Jobing</strong></td><td>One-way import of applicants from the pro.jobing.com job board. Read-only — job posting must still be done in their dashboard.</td></tr>
              <tr><td><strong>LinkedIn Recruiter</strong></td><td>Premium tier candidate import.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ===================================================================== */}
        <section>
          <h2>25. Troubleshooting</h2>
          <table>
            <thead><tr><th>Symptom</th><th>What to do</th></tr></thead>
            <tbody>
              <tr><td>&quot;Already exists&quot; alert when adding a candidate</td><td>That email is already in the database. Switch to <strong>From Database</strong> tab and reassign them to the position.</td></tr>
              <tr><td>Resume PDF returns 403</td><td>The Breezy integration user lacks resume-download permission on that role. Ask a Breezy admin to grant it, or reconnect using an admin Breezy account.</td></tr>
              <tr><td>Position duplicated on Breezy</td><td>Was a known bug; fixed. If older duplicates exist, delete them in the Breezy dashboard.</td></tr>
              <tr><td>Candidate&apos;s &quot;via&quot; source shows &quot;applied&quot;</td><td>Legacy data. Self-corrects on the next cron sync (every 5 min).</td></tr>
              <tr><td>Sync isn&apos;t running</td><td>Check the Railway cron service (<code>hr-cron-sync</code>) is Active and runs every 5 min. The curl command should hit <code>/api/cron/sync-platforms?secret=...</code>.</td></tr>
              <tr><td>&quot;Server Components render&quot; error popup</td><td>Hard-reload the page (Cmd+Shift+R / Ctrl+Shift+R). If it persists, the actor needs to share the URL with engineering.</td></tr>
              <tr><td>BG Check &quot;View Report&quot; returns 502</td><td>backgroundchecks.com might use a non-standard PDF path for your account, or the report isn&apos;t finalized yet. Try Refresh Status first; if still failing, view the report in the backgroundchecks.com dashboard directly.</td></tr>
              <tr><td>I can&apos;t see a colleague&apos;s profile</td><td>That&apos;s intentional — only admins/HR, the employee themselves, and their direct manager can view a profile.</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <p className="text-xs text-[var(--color-text-muted)] mt-10 pt-4 border-t border-[var(--color-border)]">
            CALATRAVA by Coastal Debt Resolve — User Guide. For platform changes or feature requests, check the Audit Log or contact engineering.
          </p>
        </section>
      </div>
    </div>
  );
}
