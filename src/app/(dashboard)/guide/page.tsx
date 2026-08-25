import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { GuidePrintButton } from "@/components/guide/guide-print-button";

export const metadata = { title: "Help & Guide · CALATRAVA" };

function Role({ children }: { children: ReactNode }) {
  return <span className="guide-role">{children}</span>;
}

function Note({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "success" | "warning";
}) {
  return (
    <aside className={`guide-note guide-note-${tone}`}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}

function Route({ children }: { children: ReactNode }) {
  return <code className="guide-route">{children}</code>;
}

export default async function GuidePage() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") redirect("/");

  return (
    <div className="guide-root mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <style>{`
        html { scroll-behavior: smooth; }
        .guide-root { color: var(--color-text-primary); }
        .guide-hero {
          background: linear-gradient(140deg, color-mix(in srgb, var(--color-primary-fixed) 78%, white), var(--color-surface-container-lowest));
          border: 1px solid color-mix(in srgb, var(--color-primary) 16%, var(--color-border));
          border-radius: 1.5rem;
          padding: clamp(1.5rem, 4vw, 2.75rem);
        }
        .guide-hero h1 { font-size: clamp(2rem, 5vw, 3.35rem); line-height: 1.02; letter-spacing: -0.045em; font-weight: 850; }
        .guide-summary { max-width: 46rem; margin-top: .75rem; color: var(--color-text-muted); font-size: 1rem; line-height: 1.65; }
        .guide-reviewed { margin-top: 1.25rem; display: inline-flex; align-items: center; gap: .45rem; border-radius: 999px; background: var(--color-surface-container-lowest); padding: .4rem .75rem; font-size: .75rem; font-weight: 650; color: var(--color-text-muted); }
        .guide-nav { margin: 1.5rem 0 2.5rem; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem; }
        .guide-nav a { display: flex; min-height: 3rem; align-items: center; border: 1px solid var(--color-border); border-radius: .9rem; background: var(--color-surface-container-lowest); padding: .65rem .8rem; color: var(--color-text-primary); font-size: .84rem; font-weight: 650; line-height: 1.25; transition: background-color .15s ease, border-color .15s ease; }
        .guide-nav a:hover { background: var(--color-surface-hover); border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border)); }
        .guide-prose section { scroll-margin-top: 5.25rem; margin-top: 3.25rem; }
        .guide-prose h2 { margin-bottom: .65rem; font-size: clamp(1.55rem, 3vw, 2rem); line-height: 1.15; letter-spacing: -.025em; font-weight: 780; }
        .guide-prose h3 { margin-top: 1.65rem; margin-bottom: .45rem; font-size: 1.08rem; line-height: 1.35; font-weight: 720; }
        .guide-prose p { margin-bottom: .75rem; color: var(--color-text-primary); line-height: 1.65; }
        .guide-prose ul, .guide-prose ol { margin-bottom: .9rem; padding-left: 1.35rem; }
        .guide-prose ul { list-style: disc; }
        .guide-prose ol { list-style: decimal; }
        .guide-prose li { margin-bottom: .4rem; line-height: 1.58; }
        .guide-prose li::marker { color: var(--color-primary); font-weight: 700; }
        .guide-prose strong { font-weight: 720; }
        .guide-prose table { width: 100%; margin: .9rem 0 1.25rem; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: .9rem; font-size: .88rem; }
        .guide-prose th, .guide-prose td { border-bottom: 1px solid var(--color-border); padding: .7rem .8rem; text-align: left; vertical-align: top; line-height: 1.5; }
        .guide-prose th { background: var(--color-surface-container-low); font-weight: 700; }
        .guide-prose tr:last-child td { border-bottom: 0; }
        .guide-prose code:not(.guide-route) { border-radius: .35rem; background: var(--color-surface-container-low); padding: .08rem .3rem; font-size: .88em; }
        .guide-route { display: inline-block; border: 1px solid var(--color-border); border-radius: .4rem; background: var(--color-surface-container-lowest); padding: .08rem .38rem; font-size: .82em; color: var(--color-primary); }
        .guide-role { display: inline-flex; align-items: center; border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--color-border)); border-radius: 999px; background: var(--color-primary-fixed); padding: .12rem .48rem; color: var(--color-on-primary-fixed-variant); font-size: .7rem; font-weight: 750; white-space: nowrap; }
        .guide-note { margin: 1rem 0; border: 1px solid var(--color-border); border-radius: 1rem; padding: .9rem 1rem; background: var(--color-surface-container-lowest); font-size: .92rem; }
        .guide-note > strong { display: block; margin-bottom: .25rem; }
        .guide-note > div > :last-child { margin-bottom: 0; }
        .guide-note-info { border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border)); background: color-mix(in srgb, var(--color-primary-fixed) 45%, var(--color-surface-container-lowest)); }
        .guide-note-success { border-color: color-mix(in srgb, #059669 35%, var(--color-border)); background: color-mix(in srgb, #d1fae5 48%, var(--color-surface-container-lowest)); }
        .guide-note-warning { border-color: color-mix(in srgb, #d97706 35%, var(--color-border)); background: color-mix(in srgb, #fef3c7 52%, var(--color-surface-container-lowest)); }
        .guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; margin: 1rem 0; }
        .guide-card { border: 1px solid var(--color-border); border-radius: 1rem; background: var(--color-surface-container-lowest); padding: 1rem; }
        .guide-card h3 { margin: 0 0 .35rem; }
        .guide-card p:last-child, .guide-card ul:last-child { margin-bottom: 0; }
        kbd { border: 1px solid var(--color-border); border-bottom-width: 2px; border-radius: .35rem; background: var(--color-surface-container-low); padding: .06rem .35rem; font-family: inherit; font-size: .82em; }
        @media (max-width: 760px) {
          .guide-nav, .guide-grid { grid-template-columns: 1fr; }
          .guide-prose table { display: block; overflow-x: auto; }
        }
        @media print {
          .no-print, .guide-nav { display: none !important; }
          .guide-root { max-width: none !important; padding: 0 !important; }
          .guide-hero { border: 0; padding: 0 0 1rem; background: white; }
          .guide-prose section { break-before: auto; }
          .guide-prose h2, .guide-prose h3 { break-after: avoid; }
          .guide-card, .guide-note, table, tr { break-inside: avoid; }
          .guide-role { border-color: #777 !important; background: white !important; color: black !important; }
          body { font-size: 10.5pt; }
        }
      `}</style>

      <header className="guide-hero">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <h1>Help &amp; Guide</h1>
            <p className="guide-summary">
              The current operating guide for CALATRAVA: where to go, what each action does,
              who can see it, and when an action affects email, Google Calendar, job boards,
              background screening, or payroll.
            </p>
            <span className="guide-reviewed">Current production behavior · reviewed August 13, 2026</span>
          </div>
          <div className="no-print shrink-0"><GuidePrintButton /></div>
        </div>
      </header>

      <nav className="guide-nav" aria-label="Guide contents">
        <a href="#start">Start here</a>
        <a href="#navigation">Navigation &amp; search</a>
        <a href="#feed">Feed &amp; communication</a>
        <a href="#people">People &amp; profiles</a>
        <a href="#recruitment">Recruitment</a>
        <a href="#candidate-workflows">Candidate workflows</a>
        <a href="#onboarding">Onboarding &amp; offboarding</a>
        <a href="#documents">Documents &amp; signatures</a>
        <a href="#calendar">Calendar &amp; Google</a>
        <a href="#people-programs">1:1s, reviews &amp; time off</a>
        <a href="#planning">Planning &amp; analytics</a>
        <a href="#settings">Settings &amp; integrations</a>
        <a href="#testing">Sandbox vs production</a>
        <a href="#privacy">Privacy &amp; permissions</a>
        <a href="#troubleshooting">Troubleshooting</a>
      </nav>

      <main className="guide-prose">
        <section id="start">
          <h2>Start here</h2>
          <p>
            Production is at <Route>hr.coastaldebt-tools.com</Route>. Google sign-in only accepts
            <code>@coastaldebt.com</code> accounts that were already invited in User Management.
            A valid company email that has not been invited receives a not-invited error; an email
            outside the company domain receives a domain error. Credentials sign-in works only for
            accounts that were given a password.
          </p>
          <Note title="First sign-in">
            The User record must exist first. After a successful Google sign-in, CALATRAVA links the
            account to an Employee with the same email. If no matching Employee exists, it creates the
            employee profile at that point.
          </Note>

          <h3>Roles at a glance</h3>
          <table>
            <thead><tr><th>Role</th><th>Normal scope</th></tr></thead>
            <tbody>
              <tr><td><Role>SUPER_ADMIN</Role></td><td>Full platform access, including employee archive, recruiter manager, audit log, Help &amp; Guide, permissions, and demo-data cleanup.</td></tr>
              <tr><td><Role>ADMIN</Role></td><td>Company operations: people, alerts, hiring, onboarding, documents, settings, Gusto, hiring plan, analytics, and countersigning.</td></tr>
              <tr><td><Role>HR</Role></td><td>People and HR workflows, recruitment, onboarding/offboarding, documents, reviews, time off, and analytics. The main Settings link is reserved for Admin and Super Admin.</td></tr>
              <tr><td><Role>MANAGER</Role></td><td>Company directory, their own and direct-report profiles, 1:1s, reviews, approvals, and any recruitment/analytics access granted to the Manager role.</td></tr>
              <tr><td><Role>EMPLOYEE</Role></td><td>Feed, personal profile and documents, calendar, clubs, Your Voice, time off, assigned reviews, and their own 1:1s.</td></tr>
            </tbody>
          </table>
          <p>
            The role-permission matrix can change some module access. A hidden link or blocked action
            normally means the current role does not have permission; it is not missing data.
          </p>
        </section>

        <section id="navigation">
          <h2>Navigation and universal search</h2>
          <p>
            The left sidebar shows only the modules available to the signed-in user. On mobile, use the
            bottom navigation. The CALATRAVA name in the top bar is a label, not a home button; use
            <strong> Feed</strong> in navigation to return home.
          </p>
          <div className="guide-grid">
            <div className="guide-card">
              <h3>Find anything you are allowed to see</h3>
              <p>Click the top search bar or press <kbd>⌘</kbd> + <kbd>K</kbd> on Mac and <kbd>Ctrl</kbd> + <kbd>K</kbd> on Windows.</p>
              <ul>
                <li>Search with at least two characters.</li>
                <li>Use names, preferred names, email, phone, job title, department, document title, position, source, or status.</li>
                <li>Results are grouped into Employees, Documents, Candidates, Positions, and Updates.</li>
                <li>Use arrow keys and <kbd>Enter</kbd>, or click a result.</li>
              </ul>
            </div>
            <div className="guide-card">
              <h3>Top-right controls</h3>
              <ul>
                <li>The bell opens in-app notifications and links to the related work.</li>
                <li>The avatar in the top-right opens <Route>/my-profile</Route> directly.</li>
                <li>The user card at the bottom of the desktop sidebar identifies the account but is not a profile link.</li>
                <li><strong>Sign out</strong> ends the session.</li>
              </ul>
            </div>
          </div>
          <Note title="Search respects privacy">
            Search never expands access. Admin/HR can find all employee records; managers can find
            themselves and direct reports; employees can find themselves. Candidate results require
            recruitment access, and assigned recruiters only see their candidate scope. Confidential
            HR-only documents are excluded for non-admin viewers.
          </Note>
        </section>

        <section id="feed">
          <h2>Feed, notifications, and communication</h2>
          <h3>Feed</h3>
          <p>Feed is the signed-in homepage. Anyone linked to an employee profile can create:</p>
          <ul>
            <li><strong>Posts</strong> with text, photos, file attachments, or GIFs.</li>
            <li><strong>Shoutouts</strong> to a coworker, with optional email delivery.</li>
            <li><strong>Feed events</strong> with start/end time, location, audience, RSVP, and comments.</li>
            <li><strong>Polls</strong> with 2–10 options, optional multiple selection, optional email, and Open, Public Anonymous, or Admin Anonymous results.</li>
          </ul>
          <p>Visible posts support reactions and comments. Targeted event posts are shown only to their audience and operational admins.</p>

          <h3>Notifications</h3>
          <p>
            The bell contains in-app activity. <Route>/notifications</Route> opens the full list. Personal
            email and in-app preferences live in <strong>My Profile → Notifications</strong>. Company-wide
            routing rules live in Settings and decide which actions notify candidates, recruiters,
            managers, the HR team, or the management group.
          </p>

          <h3>Emergency Alerts</h3>
          <p><Role>SUPER_ADMIN</Role> <Role>ADMIN</Role> use <Route>/alerts</Route> for urgent broadcasts.</p>
          <ol>
            <li>Enter a clear title and message.</li>
            <li>Use <strong>Send Test</strong> to send to one email first.</li>
            <li>Review the confirmation and then send the full alert.</li>
          </ol>
          <Note title="External effect" tone="warning">
            In production, a full emergency alert creates a feed item, emails employees, and sends SMS
            to employees with phone numbers. Confirm the message and audience before sending. Sandbox
            suppresses the email/SMS delivery.
          </Note>
        </section>

        <section id="people">
          <h2>People, profiles, and organization</h2>
          <h3>People directory</h3>
          <p>
            <Role>MANAGER</Role> and above use <Route>/people</Route> to search and filter active,
            onboarding, pending, and offboarded employees by name, department, or status. Current
            out-of-office and remote-work indicators also appear in the directory.
          </p>
          <ul>
            <li><Role>ADMIN</Role> and <Role>HR</Role> can add an employee or bulk import employees from CSV.</li>
            <li><Role>SUPER_ADMIN</Role> can open the archive, restore employees, or permanently purge archived data.</li>
            <li>Managers can browse the directory, but detailed profile access remains limited to themselves and direct reports.</li>
          </ul>

          <h3>Employee profile</h3>
          <p>Authorized viewers can see job information, department, manager, employment dates, relevant documents, reviews, 1:1 history, time off, emergency contact, and HR notes according to role.</p>
          <ul>
            <li>Admin/HR can edit employment details, manager, department, status, and confidential HR information.</li>
            <li>Promotion records update title/compensation history and appear in analytics.</li>
            <li>Starting offboarding moves the employee into the configured offboarding workflow.</li>
            <li>Deleting an employee is recoverable through the Super Admin archive until permanently purged.</li>
          </ul>

          <h3>My Profile</h3>
          <p>
            Everyone can open <Route>/my-profile</Route> from the sidebar or top-right avatar. Employees
            can update their photo, bio, hobbies, dietary restrictions, address, pronouns, T-shirt size,
            emergency contact, and notification preferences. Job title, department, manager, status,
            and compensation remain HR-managed.
          </p>
          <p>The profile also shows recent personal documents, buddy, reporting manager, club memberships, start date, and tenure.</p>

          <h3>Organization views</h3>
          <ul>
            <li><Route>/org</Route> shows the reporting tree and manager assignments for Manager and above.</li>
            <li><Route>/org/departments</Route> shows departments, heads, teams, and member counts. Management actions still enforce the user&apos;s permission.</li>
            <li><Route>/people/archive</Route> is Super Admin only.</li>
          </ul>
        </section>

        <section id="recruitment">
          <h2>Recruitment</h2>
          <p>
            <Route>/cv</Route> is the hiring workspace. Admin/HR have full recruitment scope. Managers or
            assigned recruiters see the scope granted to them. The page includes open positions,
            position-specific pipelines, the Candidate Database, DNC List, imports, integrations, and
            archived positions.
          </p>

          <h3>Positions</h3>
          <ul>
            <li><strong>Add Position</strong>: title, department, description, requirements, salary, type, location, and publish targets.</li>
            <li>Publish to the public Careers page, Breezy (LinkedIn + Indeed), and other configured boards.</li>
            <li>Edit a position or its individual board postings; pause, resume, or retry when the provider supports it.</li>
            <li>Use <strong>AI Match</strong> to scan the existing candidate database and pull suitable people into the pipeline.</li>
            <li>Close a filled position, reopen it, or clone it to hire for the same role again.</li>
            <li>Permanent position deletion is Super Admin only and cannot be undone.</li>
          </ul>
          <Note title="Sandbox job posting">
            Sandbox returns a simulated success for Breezy posting. It does not publish a real opening.
            Test content and UI there; verify the live job-board result only in production.
          </Note>

          <h3>Candidates and database tools</h3>
          <ul>
            <li>Add a new candidate manually, parse an uploaded resume, or assign an existing database candidate to a position.</li>
            <li>CSV import maps source columns and skips exact duplicates.</li>
            <li>Bulk Resume Upload accepts position folders, extracts PDFs with AI, and merges by email.</li>
            <li>Candidate Database filters by name, source, position, stage, dates, resume status, pipeline status, and Do Not Call.</li>
            <li><Route>/cv/duplicates</Route> detects likely duplicates by normalized email, phone, or name. Merging preserves applications, interviews, and signed documents but deletes the duplicate rows, so review the primary record carefully.</li>
            <li>The DNC List contains candidates marked Do Not Call and allows authorized users to remove that flag.</li>
          </ul>

          <h3>Recruiter tools</h3>
          <ul>
            <li>Settings defines which employees are recruiters.</li>
            <li>Assigned recruiters get <Route>/my-candidates</Route>, email/in-app assignment notifications, stage filters, candidate contact details, and resumes.</li>
            <li><Route>/recruiter-manager</Route> is Super Admin only and can review workload or move candidates between recruiters.</li>
          </ul>
        </section>

        <section id="candidate-workflows">
          <h2>Candidate workflows</h2>
          <h3>Candidate detail and stages</h3>
          <p>
            Open a candidate from a pipeline card or database result. The detail dialog contains contact
            information, resume, skills, source, notes, applications, stage history, recruiter/manager,
            interviews, offer documents, background status, and hiring controls.
          </p>
          <p>
            Move the card on the kanban or select a stage in the dialog. Pipeline stages, colors, order,
            notification recipients, and stage documents are configured in Settings. A candidate can
            have application history across multiple positions without duplicating the person record.
          </p>

          <h3>Interviews</h3>
          <ol>
            <li>Open a candidate in Screening or Interview and choose <strong>Schedule Interview</strong>.</li>
            <li>Select type, date/time, duration, interviewer, and notes.</li>
            <li>The configured company Google Calendar connection creates the invite and Google Meet link.</li>
            <li>Reschedule or cancel from the interview controls; Google is updated in production.</li>
          </ol>

          <h3>Offers and signatures</h3>
          <ul>
            <li>At Offer, prepare the offer document, verify merge fields, and send it to the candidate&apos;s email.</li>
            <li>The candidate uses the secure public link to sign; CALATRAVA stores the signed PDF and updates status.</li>
            <li>If countersignature is configured, the request moves to the assigned admin&apos;s Sign Queue after the candidate signs.</li>
          </ul>

          <h3>Background screening with Continental</h3>
          <ol>
            <li>Move the candidate to Background Check and choose the screening options. The standard package includes criminal searches and SSN/address history; optional searches can include employment, education, MVR, and 5-, 9-, or 10-panel drug testing.</li>
            <li>Saving sends the candidate a Continental Screening invitation in production. A valid candidate email is required.</li>
            <li>The status begins as <strong>Awaiting Applicant</strong>, then changes as Continental creates and completes the order. The open dialog polls automatically; <strong>Refresh Status</strong> checks immediately.</li>
            <li>When complete, authorized HR users can open <strong>View Report</strong>. The report is served through CALATRAVA so provider credentials stay private.</li>
            <li>Passed/failed completion notifications follow the Settings notification matrix.</li>
            <li>A flagged result does not automatically reject the candidate. The candidate record guides HR through a pre-adverse notice first, a configurable response period, and then the final adverse-action letter.</li>
            <li>The pre-adverse notice is sent and tracked by CALATRAVA with the report attached. <strong>Open Continental portal</strong> remains available in the same panel as a backup.</li>
          </ol>
          <Note title="Provider change" tone="info">
            New screening orders use Continental Screening Services API v2. The former
            backgroundchecks.com integration is retired; legacy reports may still be readable for old candidates.
          </Note>

          <h3>Hire and start onboarding</h3>
          <p>
            When marking a candidate Hired, enter the company email and start date and confirm the
            manager/job details. CALATRAVA creates or links the Employee, preserves the candidate
            history, sends the configured stage documents, and starts Written Offer or Onboarding
            based on the configured checklist.
          </p>
        </section>

        <section id="onboarding">
          <h2>Written Offer, onboarding, and offboarding</h2>
          <p>These pages are available to roles with the matching workflow permission.</p>
          <div className="guide-grid">
            <div className="guide-card">
              <h3>Written Offer</h3>
              <p><Route>/pre-onboarding</Route> tracks the forms and signatures a candidate must complete. When every required document is finished, the candidate moves to Onboarding automatically.</p>
            </div>
            <div className="guide-card">
              <h3>Onboarding</h3>
              <p><Route>/onboarding</Route> tracks active new-hire checklists, progress, overdue tasks, responsible owners, and recently completed onboarding.</p>
            </div>
            <div className="guide-card">
              <h3>Offboarding</h3>
              <p><Route>/offboarding</Route> tracks departing employees, last day, departure type/reason, access removal, equipment, final pay, and completion.</p>
            </div>
            <div className="guide-card">
              <h3>Checklist behavior</h3>
              <p>Settings can define base tasks and department/job-title-specific tasks. A task can belong to the employee or another owner and can trigger a document or email action.</p>
            </div>
          </div>
          <p>
            Complete tasks from the employee workflow card. Super Admin can use administrative cleanup
            controls where shown. Completing all tasks moves the workflow to its completed area; it does
            not erase the underlying employee history.
          </p>
        </section>

        <section id="documents">
          <h2>Documents and signatures</h2>
          <h3>Documents &amp; Signing</h3>
          <p><Route>/documents</Route> is available to everyone, but its contents and actions are role-scoped:</p>
          <ul>
            <li>Admin/HR can send documents, target an employee or department, configure fill/sign/countersign requirements, and track all requests.</li>
            <li>Managers see their own requests and direct-report requests.</li>
            <li>Employees see only their own requests.</li>
          </ul>
          <p>Typical statuses are Pending, Viewed, Awaiting Countersign, Signed, Declined, Expired, or Voided.</p>

          <h3>My Documents</h3>
          <p>
            <Route>/my-documents</Route> combines documents on file with personal signing tasks. Open a
            pending request to use its secure signing/fill link. HR-only documents do not appear in an
            employee&apos;s My Documents view.
          </p>

          <h3>Sign Queue</h3>
          <p>
            <Role>SUPER_ADMIN</Role> and <Role>ADMIN</Role> use <Route>/sign-queue</Route> for documents
            that have already been signed by the primary signer and now require that admin&apos;s
            countersignature. Opening a queue item shows the document before confirmation.
          </p>

          <h3>Public secure links</h3>
          <ul>
            <li><Route>/sign/[token]</Route> supports typed or drawn signatures.</li>
            <li><Route>/fill/[token]</Route> supports fillable fields plus signature.</li>
            <li>Tokens expire or stop working after the request reaches a terminal state.</li>
            <li>Do not forward a signing link to anyone except the intended signer.</li>
          </ul>
        </section>

        <section id="calendar">
          <h2>Calendar, Google Calendar, out of office, and training</h2>
          <p>
            <Route>/calendar</Route> combines permitted company events, personal Google events,
            interviews, 1:1s, training, reviews, birthdays, anniversaries, benefits dates, holidays,
            out-of-office entries, and remote-work entries. Timed events show their time in upcoming
            cards, the day agenda, and event details.
          </p>

          <h3>Connect your personal Google Calendar</h3>
          <ol>
            <li>Open Calendar and click <strong>Connect Google Calendar</strong>.</li>
            <li>Choose the Google account whose email exactly matches the employee&apos;s HRIS email.</li>
            <li>Approve calendar-event access and return to CALATRAVA.</li>
            <li>The button changes to <strong>Google Calendar connected</strong>. Personal Google events then overlay in the HRIS calendar.</li>
          </ol>
          <Note title="One connection per person" tone="warning">
            Personal calendar tokens belong to that individual user. Do not choose a shared account or
            another employee&apos;s account. If the connected Google email does not match the HRIS email,
            company-event creation is blocked until the matching account is reconnected.
          </Note>

          <h3>Create a company event</h3>
          <p><Role>MANAGER</Role> and above can create company events.</p>
          <ol>
            <li>Connect your own Google Calendar first.</li>
            <li>Click <strong>Create event</strong> and enter title, date, start time, duration, location, description, and optional Meet link.</li>
            <li>Choose the audience: departments, reusable training groups, specific people, or everyone.</li>
            <li>Review the attendee count and click <strong>Create &amp; send invites</strong>.</li>
          </ol>
          <p>
            The event is created on the creator&apos;s personal Google Calendar, so the creator is the
            organizer. Attendees with a connected calendar receive a direct calendar copy and are
            marked Going. Other attendees receive a normal Google invitation from the creator. The
            same audience sees the event in the HRIS calendar, feed, and notifications.
          </p>
          <Note title="What email should the creator receive?" tone="success">
            Google puts the event on the organizer&apos;s calendar but normally does not email the organizer
            an invitation. CALATRAVA separately sends the creator an <strong>Event created</strong>
            confirmation email. Invitees receive Google invitations only when they were not direct-added
            through their own connected CALATRAVA calendar.
          </Note>
          <p>
            Click a company event to see time, type, organizer, location, Meet link, description, and
            audience. The creator or Admin/HR can edit or cancel it. Calendar updates are pushed to the
            organizer event and connected attendee copies.
          </p>

          <h3>Set out of office</h3>
          <p>Everyone with an employee profile can click <strong>Set out of office</strong>.</p>
          <ul>
            <li>Choose Out of office, Vacation/PTO, Sick day, Doctor appointment, or Working remotely.</li>
            <li>Choose all day, morning, afternoon, or custom times and add an optional note.</li>
            <li>Share with everyone, all managers, departments, or specific people when those choices are available.</li>
            <li>The employee, direct manager, and HR/Admin retain operational visibility even when a narrower audience is selected.</li>
            <li>Upcoming entries can be removed from the same dialog.</li>
          </ul>

          <h3>Training calendar</h3>
          <p><Role>MANAGER</Role> and above can use <strong>Training</strong>.</p>
          <ul>
            <li><strong>Groups</strong>: save reusable Trainers, Trainees, and Viewers/Managers.</li>
            <li><strong>Schedule</strong>: choose a connected trainer as Google organizer, attendees, optional viewers, date range, weekdays, start/end time, location, agenda, and Meet link.</li>
            <li><strong>Manage</strong>: edit the schedule or cancel an active class and its sessions.</li>
          </ul>
          <p>Only a person with a valid personal Google Calendar connection can be selected as the class organizer.</p>
        </section>

        <section id="people-programs">
          <h2>1:1s, reviews, time off, clubs, and Your Voice</h2>
          <h3>1:1 Reviews</h3>
          <p>
            <Route>/one-on-ones</Route> tracks recurring 30-day, quarterly, and annual check-ins.
            Managers can schedule for direct reports; Admin/HR can schedule within their broader scope.
            The person who initiates a manual 1:1 becomes its manager/organizer for that meeting.
          </p>
          <ul>
            <li>Connect the organizer&apos;s personal calendar so the event is created on that calendar with the correct organizer.</li>
            <li>If no personal connection is available, the system may fall back to the configured company connection and an ICS email.</li>
            <li>Open the meeting to use the Meet link, update private manager notebook notes, complete it, reschedule it, or cancel it.</li>
            <li>Employees see their meetings; managers see their own and direct-report meetings; Admin/HR see all.</li>
          </ul>

          <h3>Performance Reviews</h3>
          <p>
            <Route>/reviews</Route> shows assigned reviews to every participant. Admin/HR create cycles,
            choose departments/dates/templates, generate Self, Manager, and optional Peer reviews, and
            monitor completion. Reviewers can submit only work assigned to them while the cycle is active.
          </p>
          <p>Anniversary review cycles appear on the calendar according to the viewer&apos;s employee/report scope.</p>

          <h3>Time Off</h3>
          <p><Route>/time-off</Route> shows policy balances, requests, who is out, a team calendar, and burnout alerts for approvers.</p>
          <ul>
            <li>Employees choose a policy, dates, and reason to submit a request.</li>
            <li>Roles with Approve Time Off can approve or deny requests.</li>
            <li>If the employee is mapped to Gusto, balances and requests use Gusto; otherwise CALATRAVA uses local policies.</li>
          </ul>

          <h3>Clubs and Your Voice</h3>
          <ul>
            <li><Route>/clubs</Route> lets employees create interest groups, join/leave, and see members.</li>
            <li><Route>/voice</Route> lets employees submit feedback without storing their identity. Admin/Super Admin can view and respond to submissions.</li>
            <li>Pulse surveys are separate from Your Voice. Active pulse questions appear in the app and expose aggregate results, not individual answers.</li>
          </ul>
        </section>

        <section id="planning">
          <h2>Hiring plan, analytics, Gusto, and audit</h2>
          <h3>Hiring Plan</h3>
          <p>
            <Role>SUPER_ADMIN</Role> <Role>ADMIN</Role> use <Route>/hiring-plan</Route> to model planned
            seats. A slot can be filled with a current employee or left TBH so leadership can compare
            the target structure with current staffing.
          </p>

          <h3>Analytics</h3>
          <p>
            <Route>/analytics</Route> is permission-based and covers headcount, department mix,
            retention, turnover, tenure, time-to-hire, cost-per-hire, source ROI, recruiter performance,
            platform spend, pipeline, onboarding, reviews, benefits, birthdays, and anniversaries.
          </p>
          <p>
            <Route>/analytics/testing</Route> is the expanded metrics workspace. Cards labeled future,
            placeholder, or not yet available are not populated by employee data yet and should not be
            reported as completed analytics.
          </p>

          <h3>Gusto</h3>
          <p>
            Admins use <Route>/gusto</Route> after connecting Gusto in Settings. It shows connection
            health, next payroll, pending time-off requests, employee count, payroll data, and mapped
            employees. Gusto-mapped employees use Gusto balances and request submission on Time Off.
          </p>

          <h3>Audit Log</h3>
          <p>
            <Route>/audit-log</Route> is Super Admin only. Filter by action, actor email, or entity type
            to investigate sign-ins and major user, employee, candidate, and position changes. Audit
            records are operational history, not a replacement for the record&apos;s current state.
          </p>
        </section>

        <section id="settings">
          <h2>Settings and integrations</h2>
          <p><Role>SUPER_ADMIN</Role> <Role>ADMIN</Role> open <Route>/settings</Route>. Panels appear in this operational order:</p>
          <div className="guide-grid">
            <div className="guide-card"><h3>Company &amp; access</h3><ul><li>Company name, domain, logo/favicon, sender name/email</li><li>User invitations, passwords, roles, and deletion</li><li>Role permission matrix</li><li>Recruiter assignments</li></ul></div>
            <div className="guide-card"><h3>Recruitment setup</h3><ul><li>Pipeline stages and candidate custom fields</li><li>Stage notification recipients</li><li>Stage and position documents</li><li>Recruitment platform records and sync controls</li></ul></div>
            <div className="guide-card"><h3>People programs</h3><ul><li>Department review templates</li><li>Departments, teams, and job titles</li><li>Written Offer, onboarding, and offboarding checklists</li><li>Time-off policies and pulse surveys</li></ul></div>
            <div className="guide-card"><h3>Delivery &amp; systems</h3><ul><li>Email templates and preview/send-test controls</li><li>Notification action/recipient/channel matrix</li><li>Native and platform integrations</li><li>Gusto connection and employee mapping</li></ul></div>
          </div>

          <h3>Notification matrix</h3>
          <p>
            Rows are system actions such as stage change, offer sent/signed, document request/signed,
            interview scheduled, onboarding, task assignment, offboarding, recruiter assignment, and
            background completion. Columns choose candidate, recruiter, manager, HR Team, or Management
            recipients and email/in-app channels. The HR Team and Management lists at the bottom define
            who those group columns mean.
          </p>

          <h3>Platform integrations</h3>
          <ul>
            <li><strong>Breezy HR</strong>: candidate sync and LinkedIn/Indeed job posting through Breezy.</li>
            <li><strong>Indeed, LinkedIn Recruiter, Jobing, Handshake, EmployFL</strong>: connect or store credentials only when that provider is actively used.</li>
            <li><strong>Google Calendar platform connection</strong>: shared connection for company-level flows such as interviews or fallback behavior. It is separate from each person&apos;s Connect Google Calendar button.</li>
            <li><strong>Continental Screening</strong>: server-managed screening credentials; not a per-user Settings connection.</li>
            <li><strong>Resend</strong>: transactional email delivery using the configured verified sender domain. Settings shows each automated email as queued, sent, delivered, delayed, or failed.</li>
            <li>Configure a signed Resend webhook to <Route>/api/email/webhook</Route> with <code>RESEND_WEBHOOK_SECRET</code> so delivered, bounced, suppressed, and complained statuses update automatically. The employee who initiated a failed email receives an in-app notification.</li>
            <li><strong>Gusto</strong>: payroll/time-off OAuth plus employee mapping.</li>
          </ul>
          <Note title="Personal vs shared Google connection">
            Company events and training must use the selected organizer&apos;s personal connection so the
            correct person appears as organizer. The shared platform connection must not be treated as
            a substitute for a creator&apos;s personal calendar on those flows.
          </Note>
        </section>

        <section id="testing">
          <h2>Sandbox vs production testing</h2>
          <table>
            <thead><tr><th>Action</th><th>Sandbox</th><th>Production</th></tr></thead>
            <tbody>
              <tr><td>Database/UI workflows</td><td>Real inside the sandbox database; data may be reset.</td><td>Real company data.</td></tr>
              <tr><td>Email</td><td>Suppressed and logged; no email leaves the system.</td><td>Sent through the live email provider.</td></tr>
              <tr><td>Job-board posting</td><td>Simulated success; nothing is published.</td><td>Publishes/updates the configured external board.</td></tr>
              <tr><td>Interview/1:1 calendar flow</td><td>Simulated event and fake Meet link.</td><td>Creates/updates live Google events and invitations.</td></tr>
              <tr><td>Company event/training</td><td>Do not use sandbox to prove external invite or organizer delivery.</td><td>Uses the organizer&apos;s live personal Google connection.</td></tr>
              <tr><td>Background check</td><td>Simulated; no Continental invitation is sent.</td><td>Creates a live Continental invitation/order.</td></tr>
            </tbody>
          </table>
          <Note title="How to test safely in production" tone="warning">
            Use production only when the requirement is an actual email, Google invitation, organizer
            identity, external posting, or Continental delivery. Put <strong>TEST</strong> in the title,
            invite the smallest possible audience, avoid real candidate/background actions unless
            approved, verify the result, and then cancel or clean up the test record.
          </Note>

          <h3>Calendar acceptance test</h3>
          <ol>
            <li>The test creator connects the Google account matching their HRIS email.</li>
            <li>Create <strong>TEST – Calendar invite</strong> for one known attendee.</li>
            <li>Confirm the event appears in HRIS with the correct time and organizer.</li>
            <li>Confirm it appears on the creator&apos;s Google Calendar.</li>
            <li>Confirm the creator receives CALATRAVA&apos;s Event created email.</li>
            <li>Confirm the attendee either receives a Google invitation or a direct calendar copy, depending on whether their calendar is connected.</li>
            <li>Cancel the test event and confirm it is removed or marked cancelled.</li>
          </ol>
        </section>

        <section id="privacy">
          <h2>Privacy and permission rules</h2>
          <ul>
            <li>Employees cannot browse other employee profiles. Managers can open themselves and direct reports. Admin/HR can open all profiles.</li>
            <li>Emergency contact is restricted to authorized operational viewers.</li>
            <li>HR notes and HR-only documents are never exposed through My Profile, My Documents, file URLs, or universal search to an unauthorized user.</li>
            <li>Documents are scoped by role even though Documents appears in every sidebar.</li>
            <li>Candidate and position search requires recruitment access; assigned recruiters remain limited to their scope.</li>
            <li>Audience-scoped feed events, company events, out-of-office entries, and training sessions are filtered for each viewer.</li>
            <li>Pulse results are aggregate. Your Voice submissions do not record the employee identity.</li>
            <li>Background reports are available only to authorized HR/management viewers and are proxied through the server.</li>
            <li>Super Admin permissions cannot be removed through the role matrix.</li>
          </ul>
        </section>

        <section id="troubleshooting">
          <h2>Troubleshooting</h2>
          <table>
            <thead><tr><th>What you see</th><th>What to do</th></tr></thead>
            <tbody>
              <tr><td>Google sign-in says not invited</td><td>Confirm User Management contains that exact company email. Being an Employee without a linked User is not enough.</td></tr>
              <tr><td>Google sign-in says wrong domain</td><td>Use the employee&apos;s <code>@coastaldebt.com</code> account.</td></tr>
              <tr><td>Calendar says not connected after it used to work</td><td>Open Calendar, disconnect if needed, reconnect the Google account matching the HRIS email, and retry. Google refresh tokens can expire or be revoked.</td></tr>
              <tr><td>Company event shows the wrong organizer</td><td>Do not recreate it with a shared account. Cancel the bad event, connect the intended creator&apos;s personal Google account, and create a clean test.</td></tr>
              <tr><td>Creator did not receive a Google invite email</td><td>Expected: Google does not invite its own organizer. Check for CALATRAVA&apos;s Event created confirmation and the event on the creator&apos;s Google Calendar.</td></tr>
              <tr><td>Invitee did not receive an invite email</td><td>If their CALATRAVA Google Calendar is connected, the event may have been added directly. Check their calendar and in-app notification. Otherwise check spam and email delivery logs.</td></tr>
              <tr><td>No email/job posting/calendar invite in sandbox</td><td>Expected. Sandbox suppresses or simulates external effects. Use the visible sandbox banner as the source of truth.</td></tr>
              <tr><td>Candidate already exists</td><td>Use Candidate Database or Add Existing to assign the existing person to the position. Do not create a duplicate.</td></tr>
              <tr><td>Continental status is still Awaiting Applicant</td><td>The candidate must complete the Continental invitation. Use Refresh Status after completion; link by email only for an existing unmatched provider order.</td></tr>
              <tr><td>Background report is unavailable</td><td>Refresh status first. Reports normally become available only after a live order is complete. Sandbox checks do not have a real report.</td></tr>
              <tr><td>A page or button is missing</td><td>Check the user&apos;s role and Settings permission matrix. Search and direct URLs enforce the same data boundaries.</td></tr>
              <tr><td>Old UI or stuck button after a deployment</td><td>Hard refresh with <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> or <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>, then retry once.</td></tr>
              <tr><td>Production email never arrives</td><td>Verify the recipient email, sender-domain configuration, Resend delivery/bounce logs, and the user&apos;s notification preferences/rules.</td></tr>
            </tbody>
          </table>

          <h3>Before reporting a bug</h3>
          <ul>
            <li>State whether it happened in sandbox or production.</li>
            <li>Include the exact page, record/person, time, and the action taken.</li>
            <li>Copy the full error message and attach a screenshot.</li>
            <li>For calendar issues, include the expected organizer, creator email, attendee, event title, and whether each person connected Google Calendar.</li>
            <li>For email issues, include recipient and subject—never paste passwords, tokens, or confidential report contents.</li>
          </ul>
        </section>

        <footer className="mt-14 border-t border-[var(--color-border)] pt-5 text-sm text-[var(--color-text-muted)]">
          CALATRAVA Help &amp; Guide · Based on the current production workflows and permission boundaries.
        </footer>
      </main>
    </div>
  );
}
