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
          .toc { display: none !important; }
        }
        .guide-prose h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 0.25rem; }
        .guide-prose h2 { font-size: 1.5rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.4rem; }
        .guide-prose h3 { font-size: 1.125rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .guide-prose h4 { font-size: 0.8rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.4rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
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
        .callout { background: color-mix(in srgb, var(--color-accent) 8%, transparent); border-left: 3px solid var(--color-accent); padding: 0.7rem 0.9rem; border-radius: 6px; margin: 0.8rem 0; font-size: 0.95rem; }
        .callout strong { color: var(--color-accent); }
        .callout-warn { background: color-mix(in srgb, #f59e0b 12%, transparent); border-left: 3px solid #f59e0b; padding: 0.7rem 0.9rem; border-radius: 6px; margin: 0.8rem 0; font-size: 0.95rem; }
        .toc { background: var(--color-background); border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
        .toc ol { column-count: 2; column-gap: 1.5rem; margin: 0; font-size: 0.9rem; }
        @media (max-width: 700px) { .toc ol { column-count: 1; } }
        kbd { background: var(--color-background); border: 1px solid var(--color-border); border-bottom-width: 2px; padding: 0.05rem 0.4rem; border-radius: 4px; font-size: 0.85em; font-family: inherit; }
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
            Field-level walkthroughs for every feature, with screenshots of the live platform. Some sections are role-gated — your sidebar will only show what you have access to.
          </p>

          <div className="toc">
            <h4>Contents</h4>
            <ol>
              <li>Sign-in &amp; roles</li>
              <li>The sidebar &amp; navigation</li>
              <li>Feed (home)</li>
              <li>Alerts</li>
              <li>People — directory</li>
              <li>Adding an employee (form-by-form)</li>
              <li>Employee profile page</li>
              <li>Promoting / editing / deleting an employee</li>
              <li>Employee Archive</li>
              <li>My Profile</li>
              <li>Recruitment — the /cv page</li>
              <li>Adding a position (every field)</li>
              <li>Editing / closing / deleting a position</li>
              <li>Posting a job to a board</li>
              <li>Adding a candidate (existing or new)</li>
              <li>Candidate detail dialog (every tab)</li>
              <li>Moving a candidate through stages</li>
              <li>Background checks — full flow</li>
              <li>Offer letters &amp; signing</li>
              <li>Hiring &amp; onboarding flow</li>
              <li>Pre-onboarding</li>
              <li>Onboarding tracker</li>
              <li>Offboarding</li>
              <li>Documents &amp; signing — admin</li>
              <li>Sign Queue (countersign)</li>
              <li>My Documents</li>
              <li>Calendar</li>
              <li>1:1 reviews</li>
              <li>Performance reviews (anniversary)</li>
              <li>Time off</li>
              <li>Your Voice (pulse)</li>
              <li>Clubs</li>
              <li>Settings — every panel</li>
              <li>Company Information</li>
              <li>User Management</li>
              <li>Departments &amp; Teams</li>
              <li>Job Titles</li>
              <li>Pipeline Stages</li>
              <li>Onboarding / Pre-onboarding / Offboarding Setup</li>
              <li>Stage Documents</li>
              <li>Email Templates (each one)</li>
              <li>Time-Off Policies</li>
              <li>Pulse Surveys</li>
              <li>Notification Settings (matrix)</li>
              <li>Platform Integrations</li>
              <li>Roles &amp; Permissions</li>
              <li>Audit Log</li>
              <li>Privacy &amp; visibility rules</li>
              <li>Integrations (deep dive)</li>
              <li>Public flows: signing &amp; filling</li>
              <li>Careers page</li>
              <li>Troubleshooting</li>
              <li>Glossary &amp; FAQ</li>
            </ol>
          </div>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>1. Sign-in &amp; roles</h2>
          <ol>
            <li>Go to <code>hr.coastaldebt-tools.com</code>.</li>
            <li>Click <strong>Sign in with Google</strong> and use your <code>@coastaldebt.com</code> account. Accounts outside this domain are rejected with <em>&quot;not-invited&quot;</em>.</li>
            <li>If you have a credentials account (email + password) you can use the password form below the Google button.</li>
            <li>On first sign-in the system creates an Employee record automatically if one doesn&apos;t exist.</li>
          </ol>

          <h3>The five roles</h3>
          <p>Your role determines which sidebar entries and actions you see. Roles are set per user in <strong>Settings → User Management</strong>.</p>
          <table>
            <thead><tr><th>Role</th><th>What they see &amp; can do</th></tr></thead>
            <tbody>
              <tr><td><span className="role-pill">SUPER_ADMIN</span></td><td>Full access. Only role that sees Audit Log, Employee Archive, Roles &amp; Permissions, and the Cleanup Demo Data button.</td></tr>
              <tr><td><span className="role-pill">ADMIN</span></td><td>Same as Super Admin minus the items above. Manages people, recruitment, onboarding, settings, integrations.</td></tr>
              <tr><td><span className="role-pill">HR</span></td><td>People, recruitment, onboarding/offboarding, documents, reviews, most of settings, notifications.</td></tr>
              <tr><td><span className="role-pill">MANAGER</span></td><td>Own profile, direct reports&apos; profiles, recruitment pipeline, 1:1s, reviews of direct reports, the company directory.</td></tr>
              <tr><td><span className="role-pill">EMPLOYEE</span></td><td>Own profile, own documents, feed, clubs, calendar, time off, 1:1s with their manager. Cannot browse colleagues.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>2. The sidebar &amp; navigation</h2>
          <p>The vertical sidebar on the left is the main nav. Sections are role-filtered. Your own avatar + role badge at the bottom doubles as a quick-link to <strong>My Profile</strong>; the <strong>Sign out</strong> button below it ends your session.</p>

          <h4>Top bar</h4>
          <ul>
            <li><strong>CALATRAVA logo</strong> — clicks back to the Feed.</li>
            <li><strong>Search bar</strong> (top center) — global search across employees, candidates, positions.</li>
            <li><strong>🔔 bell</strong> with red badge — opens the in-app notifications drawer. Click any notification to jump to the linked record. Numbers over 9 show as <code>9+</code>.</li>
            <li><strong>Your avatar</strong> (top right) — opens a quick menu with My Profile, settings, sign out.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>3. Feed — the homepage</h2>
          <GuideImage src="/guide/01-feed.png" alt="Feed homepage" caption="Feed — posts, shoutouts, events, and reactions. Everyone lands here after sign-in." />

          <h3>The composer (top)</h3>
          <ol>
            <li>Click into <strong>What&apos;s on your mind?</strong>.</li>
            <li>Choose one of four post types:
              <ul>
                <li><strong>Photo</strong> — image picker (PNG/JPG, &lt; 10 MB).</li>
                <li><strong>Attach</strong> — any file. Renders as a download link in the feed.</li>
                <li><strong>GIF</strong> — Giphy search box.</li>
                <li><strong>Shoutout</strong> — pick a colleague to celebrate. Their name appears highlighted in the post; they get a personal email + in-app notification on top of the regular post visibility.</li>
                <li><strong>Event</strong> — set a start &amp; end date, optional location. Creates a Feed post AND a Calendar event visible to everyone.</li>
              </ul>
            </li>
            <li><strong>Email all</strong> toggle (default on) — when on, every active employee gets the post as an email. Untick to keep it in-app only.</li>
            <li>Click <strong>Post</strong>.</li>
          </ol>

          <h3>Each post row</h3>
          <ul>
            <li><strong>Author avatar &amp; name</strong>.</li>
            <li><strong>Time ago</strong> (1d ago, 3h ago, etc.).</li>
            <li><strong>Content + attachments</strong>.</li>
            <li><strong>Reactions</strong>: ❤ Love / 🎉 Celebrate / 👍 Like. Counts increment as people react. Each reaction notifies the post author (configurable per user).</li>
            <li><strong>Comments</strong> — click the 💬 to expand. Comments notify the post author by email + in-app.</li>
            <li><strong>Delete</strong> — only the post author and admins see this.</li>
          </ul>

          <div className="callout">
            <strong>Notification controls:</strong> Each employee can opt out of feed-post / comment / reaction / shoutout emails in <strong>My Profile → Notifications</strong>. The original poster also chooses Email-All vs in-app-only at compose time.
          </div>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>4. Alerts (Admin only)</h2>
          <p>Sidebar → <strong>Alerts</strong>. Visible to <span className="role-pill">SUPER_ADMIN</span> <span className="role-pill">ADMIN</span> only.</p>
          <p>Surface for company-wide emergency alerts (e.g. office closure, evacuation). Composing an alert sends a high-priority email + in-app notification to every active employee. Use sparingly — they appear in red banners across the dashboard.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>5. People — directory</h2>
          <p><span className="role-pill">MANAGER</span> and above. The directory of everyone in the company.</p>
          <GuideImage src="/guide/05-people.png" alt="People list" caption="People — Pending invites at top (yellow), filters + 30 employees grid below." />

          <h3>Top of the page</h3>
          <ul>
            <li><strong>Headline count</strong>: &quot;Managing X talented individuals across Y departments.&quot;</li>
            <li><strong>Archive</strong> button (Super Admin only) — opens <code>/people/archive</code>.</li>
            <li><strong>Bulk Import</strong> (HR+) — opens the CSV import wizard (see section 6).</li>
            <li><strong>Add Employee</strong> (HR+) — opens the Add Employee form (see section 6).</li>
          </ul>

          <h3>Pending Employees block</h3>
          <p>Employees who&apos;ve been added but haven&apos;t received their login invite yet show in an amber block at the top with their job title and email. Click <strong>Approve</strong> next to each one to send their Welcome email. <strong>Approve All &amp; Send Invites</strong> processes the entire queue.</p>

          <h3>Filters &amp; sort</h3>
          <ul>
            <li><strong>Filters</strong> dropdown — by department, status (Active / Onboarding / Pending / Offboarded), role.</li>
            <li><strong>Recently Joined</strong> toggle — sort newest-first.</li>
            <li><strong>Floating + button</strong> bottom right — shortcut to Add Employee.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>6. Adding an employee — every field</h2>
          <p>Two paths.</p>

          <h3>Single add: People → Add Employee</h3>
          <ol>
            <li><strong>First name</strong> — required.</li>
            <li><strong>Last name</strong> — required.</li>
            <li><strong>Email</strong> — required; must be unique. If a Pending employee already exists with this email it&apos;s linked.</li>
            <li><strong>Job title</strong> — pick from existing list (Settings → Job Titles) or type a new one.</li>
            <li><strong>Department</strong> — dropdown.</li>
            <li><strong>Team</strong> — dropdown filtered to the chosen department.</li>
            <li><strong>Manager</strong> — searchable employee picker.</li>
            <li><strong>Buddy</strong> — pairs the new employee with a colleague for onboarding.</li>
            <li><strong>Start date</strong> — required.</li>
            <li><strong>Phone, birthday, location</strong> — optional.</li>
            <li><strong>Status</strong> — Active (default), Onboarding (kicks off the checklist flow), Pre-onboarding, Pending (no login yet).</li>
            <li>Click <strong>Save</strong>. If status is Onboarding, the system creates the User account, sends the Welcome email, and adds them to /onboarding with their assigned tasks. Otherwise they appear in People immediately.</li>
          </ol>

          <h3>Bulk add: People → Bulk Import</h3>
          <ol>
            <li>Click <strong>Bulk Import</strong>. The dialog shows a CSV template.</li>
            <li>Required columns: <code>firstName</code>, <code>lastName</code>, <code>email</code>.</li>
            <li>Optional columns: <code>jobTitle</code>, <code>phone</code>, <code>departmentId</code>, <code>departmentName</code> (creates if missing), <code>managerId</code>, <code>reportsTo</code> (matches by name), <code>startDate</code> (ISO yyyy-mm-dd), <code>location</code>.</li>
            <li>Drop your CSV onto the picker. The preview shows rows + any errors.</li>
            <li>Click <strong>Import N employees</strong>. The dialog reports the totals: created, skipped (duplicate emails), errors (invalid rows).</li>
            <li>New employees default to Status = Pending until you Approve them on the People page.</li>
          </ol>

          <div className="callout-warn">
            <strong>Heads up:</strong> Bulk Import will auto-create any Department it sees in <code>departmentName</code> that doesn&apos;t exist. Double-check your CSV — typos like <code>Sales -Openers</code> vs <code>Sales - Openers</code> will create two departments.
          </div>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>7. Employee profile page</h2>
          <p>Click any employee in the People list. The URL is <code>/people/[id]</code>.</p>

          <h3>Visibility rules</h3>
          <ul>
            <li>Admin/HR — full profile.</li>
            <li>The employee themselves — their own profile.</li>
            <li>Their direct manager — their report&apos;s profile.</li>
            <li>Everyone else — <strong>404 not found</strong>. This is intentional.</li>
          </ul>

          <h3>What&apos;s on the page</h3>
          <ul>
            <li><strong>Header card</strong> — photo, name, pronouns, status pill, job title + department. Action buttons on the right (admin/owner): Promote, Edit, Reactivate (if offboarded), Delete.</li>
            <li><strong>About</strong> — bio, hobbies, dietary restrictions.</li>
            <li><strong>Personal Info</strong> — pronouns, address, T-shirt size, tenure, anniversary.</li>
            <li><strong>Emergency Contact</strong> — name, phone, relationship. Only visible to admin/HR/owner/manager.</li>
            <li><strong>Documents</strong> — Employee documents section (uploaded by HR, signed PDFs). HR_ONLY items hidden from the employee themselves.</li>
            <li><strong>HR Notes</strong> — internal notes from HR/admin. Never shown to the employee.</li>
            <li><strong>Next 1:1</strong> — if scheduled.</li>
            <li><strong>Performance Reviews</strong> — past cycles.</li>
            <li><strong>Gusto Tab</strong> — if Gusto is connected, shows payroll info.</li>
            <li><strong>Time off</strong> — request &amp; balance (own profile only or admin/HR).</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>8. Promoting / editing / deleting an employee</h2>

          <h3>Promote</h3>
          <ol>
            <li>Profile → <strong>Promote</strong> button (admin/HR only).</li>
            <li>Dialog asks for new Job Title (required) and optional new Department.</li>
            <li>Save. The promotion is recorded in the Audit Log and announced on the Feed as a Shoutout post.</li>
          </ol>

          <h3>Edit</h3>
          <ol>
            <li>Profile → <strong>Edit</strong> button.</li>
            <li>The dialog has every field — name, email, phone, job title, department, start date, birthday, address, pronouns, T-shirt size, emergency contact.</li>
            <li>Save. Updates go live immediately. Email changes also update the linked User account.</li>
          </ol>

          <h3>Delete (archive)</h3>
          <ol>
            <li>Profile → <strong>Delete</strong> button (admin/HR).</li>
            <li>Confirm. The employee is <em>archived</em>, not hard-deleted:
              <ul>
                <li>Status set to archived; <code>archivedAt</code> timestamp recorded.</li>
                <li>Their User account is removed (login revoked).</li>
                <li>References from other employees&apos; managerId / buddyId / departmentHead are nulled.</li>
                <li>All chat / feed / time-off history stays intact.</li>
              </ul>
            </li>
            <li>The employee disappears from /people and every dropdown.</li>
          </ol>

          <h3>Reactivate (after offboarding)</h3>
          <p>If the employee was offboarded (not archived), the profile shows a <strong>Reactivate</strong> button. Click it → status returns to Active and a new login can be created.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>9. Employee Archive</h2>
          <p><span className="role-pill">SUPER_ADMIN</span> only. URL: <code>/people/archive</code>.</p>
          <p>Lists every archived employee with their name, email, last-known job title, archive date, and archive reason.</p>

          <h3>Restore</h3>
          <ol>
            <li>Click <strong>Restore</strong>.</li>
            <li>A confirm prompt asks whether to also re-enable login:
              <ul>
                <li><strong>OK</strong> = restore + recreate the User row so they can sign back in.</li>
                <li><strong>Cancel</strong> = restore the employee record only; their login stays disabled. You can invite them later via Settings → User Management.</li>
              </ul>
            </li>
          </ol>

          <h3>Delete permanently</h3>
          <p>Clicks the <strong>Delete permanently</strong> button. Asks for a confirmation, then runs the actual hard-delete cascade across chat/feed/time-off tables. Writes an audit log entry first (<code>employee.purged</code>) so the action is recoverable in records even though the data isn&apos;t.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>10. My Profile</h2>
          <GuideImage src="/guide/09-my-profile.png" alt="My Profile" caption="My Profile — documents widget, club memberships, personal info, notifications." />
          <p>Sidebar → <strong>My Profile</strong>. The page you control about yourself. URL: <code>/my-profile</code>.</p>

          <h3>Sections from top to bottom</h3>
          <ol>
            <li><strong>Header</strong> — your photo, name, pronouns, job title + department. Click your avatar to upload a new photo (PNG/JPG, &lt; 5 MB).</li>
            <li><strong>My Documents widget</strong> — your 5 most recent. <em>View all →</em> jumps to /my-documents.</li>
            <li><strong>Reports To</strong> — your direct manager.</li>
            <li><strong>My Clubs</strong> — clubs you&apos;ve joined.</li>
            <li><strong>About</strong> — bio, hobbies, dietary restrictions. Click Edit.</li>
            <li><strong>Personal Info</strong> — pronouns, address, T-shirt size. Click Edit. You cannot change job title, department, manager, or status from here — only HR can.</li>
            <li><strong>Emergency Contact</strong> — Click Edit. Visible only to you, your manager, and admin/HR.</li>
            <li><strong>Notifications</strong> — toggles for each category (per-user):
              <ul>
                <li>Email Notifications — master switch.</li>
                <li>Feed Posts — new posts in feed.</li>
                <li>Events — calendar events.</li>
                <li>Comments — replies to your posts.</li>
                <li>Shoutouts — when someone tags you.</li>
                <li>Reactions — when someone reacts to your post.</li>
                <li>Stage changes, sign requests, task assignments, performance reviews — for the relevant roles.</li>
              </ul>
            </li>
            <li><strong>Google Calendar</strong> — connect/disconnect button. When connected, your calendar events show on /calendar.</li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>11. Recruitment — the /cv page</h2>
          <p><span className="role-pill">MANAGER</span> and above. The hub for hiring.</p>
          <GuideImage src="/guide/02-cv-pipeline.png" alt="Recruitment overview" caption="Recruitment — stats row, AI search, positions list." />

          <h3>Stats row</h3>
          <ul>
            <li><strong>Open Positions</strong> — status = OPEN.</li>
            <li><strong>Active in Pipeline</strong> — candidates not HIRED or REJECTED.</li>
            <li><strong>Total Candidates</strong> — every candidate ever added or synced.</li>
            <li><strong>Archived Positions</strong> — closed/filled positions (expandable section further down).</li>
          </ul>

          <h3>Two tabs</h3>
          <ul>
            <li><strong>Recruitment</strong> — per-position kanban. The default.</li>
            <li><strong>Candidate Database</strong> — the full table of every candidate ever recorded. Lazy-loaded (shows &quot;Loading candidates…&quot; until first opened).</li>
          </ul>

          <h3>AI candidate search</h3>
          <p>The collapsible panel at the top. Two modes:</p>
          <ul>
            <li><strong>AI</strong> — type a free-text description (e.g. <em>&quot;closer with 5+ years in debt relief, bilingual&quot;</em>). The system uses GPT to rank candidates by skill / experience match. Top 10 results shown with a score.</li>
            <li><strong>Keyword</strong> — literal substring search across name, email, resume text, skills.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>12. Adding a position — every field</h2>
          <p>Recruitment → <strong>+ Add Position</strong> (top right).</p>
          <GuideImage src="/guide/11-add-position.png" alt="New Position dialog" caption="New Position — title, department, description, requirements, salary, type, location, publish targets." />
          <ol>
            <li><strong>Title*</strong> — e.g. &quot;Senior React Developer&quot;.</li>
            <li><strong>Department</strong> — dropdown of existing departments.</li>
            <li><strong>Description</strong> — multi-line. Markdown allowed for the careers page render. Pulled into Breezy &amp; Indeed when posting.</li>
            <li><strong>Requirements</strong> — bullet list or comma-separated. Drives the AI candidate match scoring.</li>
            <li><strong>Salary Range</strong> — free text, e.g. &quot;$80k - $120k&quot;.</li>
            <li><strong>Job Type</strong> — Full-time / Part-time / Contract / Temporary / Internship.</li>
            <li><strong>Location</strong> — defaults to &quot;Fort Lauderdale, FL&quot; if blank. Parse format: <code>City, State[, Country]</code>. The Breezy poster auto-builds country / city / state from this string. Words like <em>Remote</em> mark the role as remote.</li>
            <li><strong>Publish to</strong> — toggle each board:
              <ul>
                <li><strong>Careers Page</strong> — shows on <code>coastaldebt.com/careers</code>.</li>
                <li><strong>Breezy HR</strong> — syndicated to Indeed / LinkedIn / ZipRecruiter via Breezy.</li>
                <li><strong>Jobing</strong> — read-only sync from pro.jobing.com (manual post required there).</li>
              </ul>
            </li>
            <li>Click <strong>Preview Posting</strong> to see how it&apos;ll look on the careers page, then Save.</li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>13. Editing, closing, or deleting a position</h2>

          <h3>Edit</h3>
          <p>Position row → ✏ icon (Edit). Same fields as Add Position. Saving auto-republishes the Breezy posting if there is one (no duplicates).</p>

          <h3>Close / Fill</h3>
          <p>Position row → <strong>Close</strong> button. Sets the position status to CLOSED and automatically:</p>
          <ul>
            <li>Closes the corresponding posting on Breezy (state = closed).</li>
            <li>Unpublishes the careers page entry.</li>
            <li>Removes it from the &quot;Open Positions&quot; list (moves to Archived).</li>
          </ul>
          <p>Setting status to FILLED in the candidate detail dialog when hiring does the same close-on-all-boards effect.</p>

          <h3>Delete</h3>
          <p><span className="role-pill">SUPER_ADMIN</span> only. Position row → 🗑 button. Asks for confirmation. Candidates linked to the position keep their profiles (just detached). Interviews on the position are removed.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>14. Posting a job to a board</h2>
          <p>Each position card has a <strong>Job boards</strong> sub-panel listing where it&apos;s posted with status pills.</p>

          <h3>Careers Page</h3>
          <p>Toggle ON to publish to <code>coastaldebt.com/careers</code>. Anyone can apply via the public form there — applicants land in the position&apos;s &quot;New&quot; column with source &quot;careers-page&quot;.</p>

          <h3>Breezy HR</h3>
          <ol>
            <li>Click <strong>Post to Breezy</strong>.</li>
            <li>The system signs into Breezy, creates the position with title + description + requirements + city/state/country + job type.</li>
            <li>Breezy syndicates to Indeed (sponsored), LinkedIn (organic), ZipRecruiter, Google for Jobs, etc.</li>
            <li>The Breezy externalId is saved so subsequent clicks <strong>republish the same posting</strong> rather than creating duplicates.</li>
            <li>Use the status icon next to Breezy to see Published / Paused / Failed.</li>
          </ol>

          <h3>Jobing</h3>
          <p>Read-only sync. Posting must still be done in the pro.jobing.com dashboard; applicants from there are imported automatically every cron cycle.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>15. Adding a candidate</h2>
          <p>Position row → <strong>Add Candidate</strong>.</p>

          <h3>Required: Assign Recruiter</h3>
          <p>The recruiter dropdown is required when any recruiter is configured. The assigned recruiter receives an email + in-app notification (action <code>RECRUITER_ASSIGNED</code>).</p>

          <h3>Tab: From Database</h3>
          <p>Search by name/email. Any existing candidate not already on this position is selectable. Click <strong>Add</strong> next to a row to assign them.</p>

          <h3>Tab: New Candidate</h3>
          <ol>
            <li>First name *, Last name *, Email *.</li>
            <li>Phone (optional).</li>
            <li>Skills — comma-separated, e.g. <code>sales, CRM, bilingual</code>.</li>
            <li>Click <strong>Add Candidate</strong>. If the email already exists you get an alert; use the From Database tab instead.</li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>16. The Candidate Detail dialog</h2>
          <p>Click any candidate card. The dialog has every field plus action panels.</p>

          <h3>Identity section</h3>
          <ul>
            <li>First name, Last name, Email, Phone, LinkedIn URL.</li>
            <li>Skills (comma-separated).</li>
            <li>Experience (free text).</li>
            <li>Source — the board / referral / direct (auto-set when synced).</li>
            <li>Notes — free text, internal only.</li>
          </ul>

          <h3>Recruitment section</h3>
          <ul>
            <li><strong>Status</strong> — the stage dropdown. Changing it triggers a stage-change notification + audit log entry.</li>
            <li><strong>Position</strong> — which position they&apos;re on.</li>
            <li><strong>Manager</strong> &amp; <strong>Recruiter</strong> dropdowns.</li>
            <li><strong>Cost of hire</strong>, <strong>Hourly rate</strong>.</li>
          </ul>

          <h3>Resume</h3>
          <p>If a resume PDF exists you can view it inline. Resume text (parsed) appears in a collapsible block — fed into the AI search index.</p>

          <h3>Application history</h3>
          <p>List of every stage transition for this candidate — when it happened, who moved them. Especially useful when reading the Audit Log.</p>

          <h3>Background Check options panel</h3>
          <p>Only visible when status = BACKGROUND_CHECK. See section 18.</p>

          <h3>Offer section</h3>
          <p>Upload offer PDF, click Send. See section 19.</p>

          <h3>Do Not Call &amp; Adverse Action</h3>
          <ul>
            <li><strong>Mark Do Not Call</strong> — checkbox + reason. Auto-sets status to REJECTED. Permanent (can be undone via Unmark).</li>
            <li><strong>Send Adverse Action Letter</strong> — appears when BG check is FAILED. Sends the standard rejection letter and locks the candidate as REJECTED + Do Not Call.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>17. Moving a candidate through stages</h2>
          <p>Three ways:</p>
          <ol>
            <li>Hover the card on the kanban → click the <strong>→</strong> button to advance to the next stage.</li>
            <li>Click the card → change Status dropdown → Save.</li>
            <li>Drag-and-drop between columns (browser permitting).</li>
          </ol>
          <p>Every move writes an audit row: <code>candidate.status.changed</code> with actor, from-stage, to-stage, timestamp.</p>

          <h3>Stage-specific behavior</h3>
          <table>
            <thead><tr><th>Move to…</th><th>What happens</th></tr></thead>
            <tbody>
              <tr><td>SCREENING, INTERVIEW, OFFER, HIRED, REJECTED, OFFBOARDING</td><td>Immediate. Notifications fire to configured recipients.</td></tr>
              <tr><td><strong>BACKGROUND_CHECK</strong></td><td>Doesn&apos;t fire the check immediately — instead opens the detail dialog so you can configure check options. Click Save to actually order the check.</td></tr>
              <tr><td><strong>HIRED</strong></td><td>Opens the detail dialog so you can supply company email + start date + manager. Creates an Employee record, kicks off onboarding.</td></tr>
              <tr><td><strong>REJECTED</strong></td><td>Can be set explicitly via dropdown, or as a side-effect of Mark Do Not Call or Send Adverse Action Letter. All three paths are audited.</td></tr>
              <tr><td>PRE_ONBOARDING / ONBOARDING</td><td>Usually set automatically when a candidate is Hired. Manual moves trigger task assignment per the checklist setup.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>18. Background checks — full flow</h2>
          <p>Provider: <strong>backgroundchecks.com</strong>. Integrated end-to-end.</p>

          <h3>Initiating a check</h3>
          <ol>
            <li>Move the candidate to BG Check (via kanban or dialog). The detail dialog opens automatically.</li>
            <li>In the <strong>Background Check Options</strong> panel choose:
              <ul>
                <li><strong>Report tier</strong>: HIRE1 (basic) / HIRE2 (mid) / HIRE3 (deep). Cost increases per tier.</li>
                <li><strong>Drug test</strong> — Y/N + panel: drug (5-panel) / drug9 (9-panel) / drug10 (10-panel).</li>
                <li>Optional checks: MVR, employment verification, education, federal &amp; county criminal, bankruptcy, civil judgment, tax lien, credit report.</li>
              </ul>
            </li>
            <li>Click <strong>Save</strong>. The system posts to <code>app.backgroundchecks.com/api/orders/new</code>. The candidate&apos;s email gets an invite link; the report_key is stored on their record.</li>
            <li>Status flips to <code>AWAITING_APPLICANT</code> until they complete their form.</li>
          </ol>

          <h3>Tracking the result</h3>
          <ul>
            <li>The dialog shows a colored status pill: <em>Awaiting Applicant → Processing → Passed/Flagged</em>.</li>
            <li><strong>Refresh Status</strong> button polls backgroundchecks.com for updates.</li>
            <li><strong>View Report</strong> button (purple) — only appears when the report exists. Opens the full PDF in a new tab, streamed from backgroundchecks.com via our server (so the API key never reaches the browser).</li>
            <li><strong>Mark Passed / Mark Failed</strong> — manual override when status is still Pending. Clicking Failed triggers the Adverse Action flow.</li>
          </ul>

          <h3>If flagged / failed</h3>
          <p>When backgroundchecks.com flags the report:</p>
          <ol>
            <li>The system auto-sends an <strong>Adverse Action Letter</strong> email to the candidate (template configurable in Settings → Email Templates).</li>
            <li>Their candidate record is set to: <code>status = REJECTED</code>, <code>doNotCall = true</code>, <code>doNotCallReason = &quot;Background check failed&quot;</code>.</li>
            <li>The audit log records this as <code>candidate.status.changed</code> with <code>via: adverse_action_letter</code>.</li>
            <li>You can&apos;t accidentally double-send — the dialog shows &quot;already sent on date X&quot;.</li>
          </ol>

          <div className="callout-warn">
            <strong>Important:</strong> Once Marked Failed / Adverse Action sent, the candidate is locked as Do Not Call. To reverse, an admin must use Unmark Do Not Call (and even then the audit log keeps the original event).
          </div>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>19. Offer letters &amp; signing</h2>
          <ol>
            <li>Move candidate to <strong>Offer</strong> stage.</li>
            <li>In the detail dialog, scroll to the Offer section.</li>
            <li>Upload the offer PDF (drag/drop or file picker). The file is stored in the platform&apos;s file blob storage.</li>
            <li>Click <strong>Send Offer</strong>. The candidate gets an email from <code>hrteam@hr.coastaldebt-tools.com</code> with a tokenized signing link.</li>
            <li>They click the link → land on <code>/sign/[token]</code> (public, no login needed) → draw or type their signature → click Sign. The signed PDF is generated server-side via pdf-lib.</li>
            <li>You get an in-app + email notification (action: <code>OFFER_SIGNED</code>).</li>
            <li>The dialog now shows &quot;Signed on date X&quot; with a Download Signed PDF link.</li>
            <li>Move to Hired when ready.</li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>20. Hiring &amp; onboarding flow</h2>
          <ol>
            <li>Move candidate to <strong>Hired</strong>. The detail dialog opens.</li>
            <li>Fill the company-side fields:
              <ul>
                <li><strong>Company email</strong> — their new <code>@coastaldebt.com</code> address.</li>
                <li><strong>Start date</strong>.</li>
                <li><strong>Manager</strong> (optional override).</li>
                <li><strong>Skip Welcome email</strong> toggle.</li>
              </ul>
            </li>
            <li>Click <strong>Confirm Hire</strong>.</li>
            <li>The system:
              <ul>
                <li>Creates an Employee record with status <code>ONBOARDING</code> (or <code>PRE_ONBOARDING</code> if pre-onboarding tasks exist for that department + job title).</li>
                <li>Creates a User account so they can sign in with Google when start date arrives.</li>
                <li>Sends the Welcome email with sign-in link (unless you ticked Skip).</li>
                <li>Assigns onboarding tasks per the checklist setup. Tasks may include documents to sign, emails to fire, or actions assigned to other employees (e.g. IT for laptop, HR for paperwork).</li>
                <li>Anniversary review cycle is scheduled for 1 year from start date.</li>
              </ul>
            </li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>21. Pre-onboarding</h2>
          <p><span className="role-pill">HR</span> and above. Sidebar → <strong>Pre-Onboarding</strong>.</p>
          <p>Used for roles where the new hire has tasks to complete <em>before</em> their start date (e.g. background check finalization, signing initial documents). Triggered automatically when a candidate moves to Hired AND their department + job title has pre-onboarding checklist items configured.</p>

          <h3>The page</h3>
          <ul>
            <li>Stats: Active Pre-Onboarding, Completed, Pending Tasks.</li>
            <li>Each pre-onboarding employee shows with task progress.</li>
            <li><strong>Move to Onboarding</strong> button appears once all pre-onboarding tasks are done — flips status and assigns the regular onboarding tasks.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>22. Onboarding tracker</h2>
          <p><span className="role-pill">HR</span> and above.</p>
          <GuideImage src="/guide/18-onboarding.png" alt="Onboarding" caption="Onboarding — Active onboarding count, completed this month, pending tasks." />
          <ul>
            <li>Active Onboarding count.</li>
            <li>Completed This Month.</li>
            <li>Pending Tasks across all current new hires.</li>
            <li>Per-employee progress: which tasks done, which pending. Click a task to mark complete or open the linked document.</li>
            <li><strong>Move to Active</strong> button on each employee once all onboarding tasks complete — flips status to ACTIVE.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>23. Offboarding</h2>
          <p><span className="role-pill">HR</span> and above.</p>
          <ol>
            <li>People → click the employee → scroll to <strong>Start Offboarding</strong> button (or sidebar → Offboarding → pick them).</li>
            <li>Pick their last day in the dialog.</li>
            <li>Save. The system:
              <ul>
                <li>Sets status to OFFBOARDED with endDate.</li>
                <li>Revokes their login immediately (User row deleted).</li>
                <li>Creates offboarding tasks per the configured checklist (IT — revoke access, HR — exit interview, Finance — final pay, etc.).</li>
                <li>Sends notification email to the configured <strong>Management group</strong> (Settings → Notifications).</li>
                <li>Logs <code>employee.offboarding_started</code> in the audit log.</li>
              </ul>
            </li>
            <li>Track task completion on the Offboarding page until all are done. The offboarded employee no longer appears in People (filter on status = OFFBOARDED to view).</li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>24. Documents &amp; signing — admin</h2>
          <p><span className="role-pill">MANAGER</span> and above. Sidebar → <strong>Documents</strong>.</p>
          <GuideImage src="/guide/07-documents.png" alt="Documents page" caption="Documents & Signing — Total / Pending / Awaiting Signature / Signed counters + filterable list." />

          <h3>The counters</h3>
          <ul>
            <li><strong>Total</strong> — every doc ever sent.</li>
            <li><strong>Pending</strong> — sent but not viewed by the recipient.</li>
            <li><strong>Awaiting Signature</strong> — viewed but not signed.</li>
            <li><strong>Signed</strong> — fully complete.</li>
          </ul>

          <h3>Send for Signing flow</h3>
          <ol>
            <li>Click <strong>Send for Signing</strong>. The dialog opens.</li>
            <li>Choose <strong>Recipient</strong>: an employee or candidate.</li>
            <li>Upload PDF.</li>
            <li>Give it a name (defaults to the file name).</li>
            <li>Optionally place signature fields by clicking on the PDF preview — each click drops a signature box at that position on that page.</li>
            <li>Optional <strong>Countersigner</strong> — pick a second employee who must counter-sign after the first signer.</li>
            <li>Click <strong>Send</strong>. The recipient gets the email; the doc appears in the list with status Pending.</li>
          </ol>

          <h3>Send for Filling flow</h3>
          <p>For fillable PDFs (forms with text fields). Same as Send for Signing but the recipient lands on <code>/fill/[token]</code> where they type into fields, then sign. Often used for I-9, W-4, etc.</p>

          <h3>Filter tabs</h3>
          <p>All / Pending / Signed / Voided.</p>

          <h3>Per-row actions</h3>
          <ul>
            <li><strong>View</strong> — open the latest PDF (original or signed).</li>
            <li><strong>Resend</strong> — re-send the signing email if they lost the link.</li>
            <li><strong>Copy link</strong> — get the tokenized URL to paste in chat.</li>
            <li><strong>Void</strong> — cancel the signing request. The recipient can no longer access it.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>25. Sign Queue (countersign)</h2>
          <p>Sidebar → <strong>Sign Queue</strong>. Shows every document waiting for <em>your</em> counter-signature. Each row has a Sign button that opens the document with a signature field for you to draw or upload.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>26. My Documents</h2>
          <GuideImage src="/guide/10-my-documents.png" alt="My Documents" caption="My Documents — your personal hub for documents and signing tasks." />

          <h3>Status badges</h3>
          <ul>
            <li><strong>Waiting for you</strong> — yellow. Open the link, sign, done.</li>
            <li><strong>Awaiting countersign</strong> — purple. You signed; waiting on a manager/HR signer.</li>
            <li><strong>Signed</strong> — green. Fully complete.</li>
            <li><strong>On file</strong> — gray. Uploaded by HR (offer letter, W-4, etc.), nothing for you to do.</li>
            <li><strong>Voided</strong> — gray. Cancelled.</li>
          </ul>

          <p>HR_ONLY documents are filtered out — you don&apos;t see them here even if they&apos;re tagged to you.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>27. Calendar</h2>
          <GuideImage src="/guide/04-calendar.png" alt="Calendar" caption="Calendar — Month view with mixed events." />

          <h3>View modes</h3>
          <p>Month / Week / Day toggle (top right). The blue dot below the date is &quot;today&quot;.</p>

          <h3>What appears (role-dependent)</h3>
          <ul>
            <li><strong>Birthdays</strong> 🎂 — everyone, public.</li>
            <li><strong>Work anniversaries</strong> 🎉 — everyone, public.</li>
            <li><strong>Holidays</strong> — Jewish (red), Muslim (green), Christian (purple), US federal (blue). Toggle in Settings.</li>
            <li><strong>Interviews</strong> — manager+ only. Shows candidate name + Meet link.</li>
            <li><strong>Benefits eligibility dates</strong> — manager+ only.</li>
            <li><strong>Anniversary review cycles</strong> — scoped per role: admin/HR see all; manager sees own + direct reports; employee sees only their own.</li>
            <li><strong>Company events</strong> — events posted to the Feed.</li>
            <li><strong>Your personal Google Calendar</strong> — only when you&apos;ve connected it in Settings.</li>
          </ul>

          <h3>Creating an event (manager+)</h3>
          <ol>
            <li>Click <strong>Create event</strong> (top right).</li>
            <li>Title, start, end, location.</li>
            <li>Optionally restrict to specific departments — only members of those departments see it on their calendar.</li>
            <li>Save. Also posts to the Feed as an Event card.</li>
          </ol>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>28. 1:1 reviews</h2>
          <p>Sidebar → <strong>1:1 Reviews</strong>.</p>
          <GuideImage src="/guide/17-one-on-ones.png" alt="1:1 Reviews" caption="1:1 Reviews — Upcoming (33) and Completed tabs, with each meeting showing manager + report and date." />

          <h3>Scheduling a 1:1 (manager+)</h3>
          <ol>
            <li>Click <strong>+ New 1:1</strong>.</li>
            <li>Pick the employee (direct reports list for managers; all employees for admins/HR).</li>
            <li>Pick the type: 30-day, Annual, Quarterly, Ad-hoc.</li>
            <li>Pick date &amp; time.</li>
            <li>Save. If Google Calendar is connected on both accounts, a calendar event with a Meet link is created automatically.</li>
          </ol>

          <h3>Running the meeting</h3>
          <ol>
            <li>Open the 1:1 record (click Open on the row).</li>
            <li>Two tabs: <strong>Notebook</strong> (shared markdown notes editable live by both participants) and <strong>History</strong> (past 1:1s with this person).</li>
            <li>During the meeting, take notes in the Notebook. Auto-saves every few seconds.</li>
            <li>When done, click <strong>Mark Complete</strong>. The 1:1 moves to the Completed tab. Notebook becomes read-only.</li>
          </ol>

          <p>Past 1:1 history visible only to: admin/HR, the employee themselves, and their direct manager.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>29. Performance reviews (anniversary)</h2>
          <p><span className="role-pill">MANAGER</span> and above. Sidebar → <strong>Reviews</strong>.</p>
          <GuideImage src="/guide/16-reviews.png" alt="Reviews" caption="Reviews — active cycles, per-employee progress." />

          <h3>How review cycles work</h3>
          <ul>
            <li>A daily cron runs at midnight checking who has a work anniversary in 14 days.</li>
            <li>For each match: a new <strong>Review Cycle</strong> is created with two reviews — SELF (employee fills out their own) and MANAGER (their manager fills out theirs).</li>
            <li>Both parties get an email + in-app notification.</li>
            <li>The cycle has a 30-day window to complete.</li>
          </ul>

          <h3>Filling out a review</h3>
          <ol>
            <li>Open the cycle → click your assigned review.</li>
            <li>The template loads — questions vary per department template (configured in Settings → Department Templates).</li>
            <li>Fill, save draft, or submit.</li>
            <li>Submitted reviews are read-only.</li>
            <li>Once both SELF and MANAGER are submitted, the cycle shows Complete in the dashboard.</li>
          </ol>

          <h3>Manual cycles (admin)</h3>
          <p>Click <strong>+ New Cycle</strong>. Pick employee + start/end + template. Optionally toggle Anniversary (auto-scheduled) or Custom.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>30. Time off</h2>

          <h3>Requesting time off (employee)</h3>
          <ol>
            <li>Go to My Profile → Time Off section (or the Time Off page if visible).</li>
            <li>Click <strong>Request Time Off</strong>.</li>
            <li>Pick policy (Vacation / Sick / Personal / Bereavement, etc. — configured by HR).</li>
            <li>Pick start &amp; end dates.</li>
            <li>Optional reason.</li>
            <li>Submit. Your manager gets an email + in-app notification.</li>
          </ol>

          <h3>Approving requests (manager / admin)</h3>
          <ol>
            <li>Notification clicks through to the request row.</li>
            <li>Review dates / balance / reason.</li>
            <li>Click <strong>Approve</strong> or <strong>Deny</strong>.</li>
            <li>Self-approval is blocked — an employee cannot approve their own request.</li>
          </ol>

          <h3>Balances &amp; policies</h3>
          <ul>
            <li><strong>Balance widget</strong> on your profile shows days used / remaining per policy.</li>
            <li><strong>Policy</strong> — configured in Settings → Time-Off Policies. Defines days/year, unlimited toggle, accrual rules.</li>
            <li><strong>Assignment</strong> — admin assigns each policy to specific employees in Settings (different policies for different roles/tenures).</li>
            <li><strong>Burnout report</strong> — Settings → Burnout Alerts. Shows employees who haven&apos;t taken time off in 6+ months.</li>
            <li><strong>Who&apos;s Out today</strong> — widget on the homepage + calendar markers.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>31. Your Voice (anonymous pulse)</h2>
          <p>Sidebar → <strong>Your Voice</strong>. The anonymous mood-survey feature.</p>
          <ul>
            <li>An admin creates a question in Settings → Pulse Surveys.</li>
            <li>The active survey appears as a popup on the homepage prompting a 1-5 rating.</li>
            <li>Responses are aggregated server-side; individual responses are never shown to anyone.</li>
            <li>Once submitted, you don&apos;t see the popup again until the next survey.</li>
            <li>Results: Settings → Pulse Surveys → click any past survey → average score + distribution histogram.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>32. Clubs</h2>
          <p>Sidebar → <strong>Clubs</strong>. Lightweight social groups.</p>
          <ul>
            <li>Anyone can create a club: name, description, icon.</li>
            <li>Members join by clicking <strong>Join</strong>.</li>
            <li>Each club has its own mini-feed for posts &amp; comments.</li>
            <li>Club memberships appear on your profile.</li>
            <li>Examples: Soccer Club, Book Club, FIFA World Cup 2026 (per the live data).</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>33. Settings — every panel</h2>
          <p><span className="role-pill">ADMIN</span> and above. Sidebar → <strong>Settings</strong>.</p>
          <p>Single long page. The next sections cover each panel top-to-bottom.</p>
        </section>

        <section>
          <h2>34. Company Information</h2>
          <GuideImage src="/guide/06-settings.png" alt="Company Information panel" caption="Company Info — first panel on /settings." />
          <ul>
            <li><strong>Company Name</strong> — used everywhere the brand shows.</li>
            <li><strong>Domain</strong> — your company website (e.g. <code>www.coastaldebt.com</code>).</li>
            <li><strong>Industry</strong> — free text, used in reports.</li>
            <li><strong>Company Size</strong> — headcount, auto-filled from active employees.</li>
            <li><strong>Company Logo</strong> — uploaded image, displayed on sign-in, careers page, emails.</li>
            <li><strong>Favicon</strong> — small icon for the browser tab.</li>
            <li><strong>Sender Email</strong> — the FROM address for outbound mail. Must be a Resend-verified domain (defaults to <code>hrteam@hr.coastaldebt-tools.com</code>).</li>
            <li><strong>Sender Name</strong> — display name on outbound emails.</li>
            <li>Save changes.</li>
          </ul>
        </section>

        <section>
          <h2>35. User Management</h2>
          <ul>
            <li><strong>Invite User</strong> button — opens the invite dialog: email, role, optional starter password.</li>
            <li>Each existing user row shows: email, role, linked employee.</li>
            <li>Per-row actions: change role, set password, delete user.</li>
            <li>Role hierarchy guard: ADMINs can&apos;t manage SUPER_ADMIN accounts. Only SUPER_ADMINs can mint other SUPER_ADMINs.</li>
            <li>You can&apos;t delete your own account.</li>
            <li>Every change here goes to the Audit Log: <code>user.invited</code>, <code>user.role.changed</code>, <code>user.password.set</code>, <code>user.deleted</code>.</li>
          </ul>
        </section>

        <section>
          <h2>36. Departments &amp; Teams</h2>
          <ul>
            <li>List of departments with head + employee count.</li>
            <li>Add / rename / delete departments.</li>
            <li>Each department can have multiple Teams (sub-units).</li>
            <li>Deleting a department detaches its employees (sets <code>departmentId = null</code>) rather than failing.</li>
          </ul>
        </section>

        <section>
          <h2>37. Job Titles</h2>
          <p>The canonical list used in employee profiles and the Add Position dropdown. Add a new title via the input + button. Delete unused ones; deletion is blocked if any employee or position currently uses the title.</p>
        </section>

        <section>
          <h2>38. Pipeline Stages</h2>
          <p>Customizes the kanban columns on /cv.</p>
          <ul>
            <li>Each stage has: label, color, icon, visibility toggle, order.</li>
            <li>Drag to reorder. The default 9 stages are: NEW, SCREENING, INTERVIEW, OFFER, BACKGROUND_CHECK, PRE_ONBOARDING, ONBOARDING, HIRED, OFFBOARDING, REJECTED.</li>
            <li>NEW, HIRED, REJECTED cannot be removed (system-critical).</li>
            <li>Hide a stage by toggling Visible off — keeps the data, just hides the column.</li>
          </ul>
        </section>

        <section>
          <h2>39. Pre-onboarding / Onboarding / Offboarding Setup</h2>
          <GuideImage src="/guide/13-onboarding-setup.png" alt="Onboarding setup panels" caption="Pre-Onboarding / Onboarding / Offboarding Setup — each has a Department selector and a Base Tasks list." />

          <h3>How checklists resolve</h3>
          <p>When a candidate is hired (or moved to onboarding/offboarding), the system assigns tasks based on:</p>
          <ol>
            <li><strong>Global Base Tasks</strong> (Department = &quot;Global&quot;) — apply to everyone.</li>
            <li><strong>Department Base Tasks</strong> — apply when their department matches.</li>
            <li><strong>Job Title Override</strong> — replaces Department tasks for a specific job title (e.g. Sales Closer gets extra tasks vs the generic Sales).</li>
            <li><strong>Exclusions</strong> — within an Override you can exclude specific Base Tasks.</li>
          </ol>

          <h3>Each task can include</h3>
          <ul>
            <li><strong>Title</strong> (required), <strong>Description</strong>.</li>
            <li><strong>Assignee</strong> — who owns the task (employee or generic role like IT/HR).</li>
            <li><strong>Due day</strong> — N days after start.</li>
            <li><strong>Send Email</strong> — fire an email to the assignee with custom subject/body.</li>
            <li><strong>Document</strong> — attach a PDF + action: None / Sign / Fill. Sets up a signing request automatically when the task is created.</li>
            <li><strong>Document Recipient</strong> — Employee (the new hire), Assignee (the task owner), or External (custom email).</li>
          </ul>
        </section>

        <section>
          <h2>40. Stage Documents</h2>
          <p>PDFs auto-attached to candidates / employees when they reach specific stages (HIRED, PRE_ONBOARDING, ONBOARDING, OFFBOARDING).</p>
          <ul>
            <li>Upload a PDF + placeholders (<code>{`{{firstName}}`}</code>, <code>{`{{startDate}}`}</code>, etc.) for auto-fill.</li>
            <li>Toggle Requires Signature / Requires Fill / Requires Countersignature.</li>
            <li>Pick a Countersigner if required.</li>
            <li>Documents fire automatically — no manual sending needed.</li>
          </ul>
        </section>

        <section>
          <h2>41. Email Templates — each one</h2>
          <GuideImage src="/guide/14-email-templates.png" alt="Email Templates" caption="Email Templates panel — collapsible list, each with a description and override controls." />
          <p>Every transactional email is templated. Click any row to expand:</p>
          <table>
            <thead><tr><th>Template</th><th>When it fires</th></tr></thead>
            <tbody>
              <tr><td>WELCOME</td><td>New user invited / hired.</td></tr>
              <tr><td>SIGNING REQUEST</td><td>Document sent for signing.</td></tr>
              <tr><td>TASK ASSIGNMENT</td><td>Onboarding task assigned.</td></tr>
              <tr><td>SIGNING CONFIRMATION</td><td>After successful signing.</td></tr>
              <tr><td>ONBOARDING</td><td>General onboarding email with optional doc.</td></tr>
              <tr><td>OFFER LETTER</td><td>Offer sent to candidate.</td></tr>
              <tr><td>ADVERSE ACTION</td><td>Background check failed.</td></tr>
              <tr><td>STAGE CHANGE</td><td>Candidate moved through pipeline.</td></tr>
              <tr><td>ANNIVERSARY REVIEW</td><td>Performance review opened.</td></tr>
              <tr><td>SHOUTOUT</td><td>You got tagged in a shoutout.</td></tr>
            </tbody>
          </table>

          <h3>Editing a template</h3>
          <ol>
            <li>Expand a template.</li>
            <li>Edit subject (one line) + body (HTML allowed).</li>
            <li>Use <code>{`{{variable}}`}</code> placeholders — available variables are listed below the editor.</li>
            <li>Click <strong>Preview</strong> to render with sample data.</li>
            <li>Click <strong>Send Test</strong> to email yourself a preview.</li>
            <li>Save. Reset to Default reverts to the built-in template.</li>
          </ol>
        </section>

        <section>
          <h2>42. Time-Off Policies</h2>
          <ul>
            <li>Add policy: name, days per year (or Unlimited), optional policy PDF for legal terms.</li>
            <li>Per-employee assignment: which employees get which policies (for tenure-based PTO accruals).</li>
            <li>Delete policies that aren&apos;t in use.</li>
          </ul>
        </section>

        <section>
          <h2>43. Pulse Surveys</h2>
          <ul>
            <li>Single input box: the question.</li>
            <li>Click Create — closes the previous active survey and opens this one.</li>
            <li>Past surveys list with Closed status + response count.</li>
            <li>Click the chart icon to see avg mood + distribution.</li>
          </ul>
        </section>

        <section>
          <h2>44. Notification Settings — the matrix</h2>
          <GuideImage src="/guide/12-notification-settings.png" alt="Notification Settings matrix" caption="Full Notification Settings matrix — Action × Recipient × Channel + HR Team + Management groups." />

          <h3>The matrix</h3>
          <p>Rows = Actions. Columns = Email recipients (Candidate / Recruiter / Manager / HR Team / Management) and In-App recipients (same minus Candidate, since candidates don&apos;t have accounts).</p>

          <h3>Available actions</h3>
          <ul>
            <li><strong>Candidate Stage Change</strong> — moved between pipeline stages.</li>
            <li><strong>Offer Letter Sent</strong>.</li>
            <li><strong>Offer Signed</strong>.</li>
            <li><strong>Document Sign Request</strong> — when an HR doc is sent for signing.</li>
            <li><strong>Document Signed</strong> — when the signing completes.</li>
            <li><strong>Interview Scheduled</strong>.</li>
            <li><strong>New Hire / Onboarding</strong>.</li>
            <li><strong>Task Assigned</strong>.</li>
            <li><strong>Onboarding Completed</strong>.</li>
            <li><strong>Employee Offboarding Started</strong>.</li>
            <li><strong>Recruiter Assigned to Candidate</strong>.</li>
          </ul>

          <h3>The two groups (bottom)</h3>
          <ul>
            <li><strong>HR Team Recipients</strong> — anyone here gets every notification where the HR Team column is enabled.</li>
            <li><strong>Management Recipients</strong> — same, for the Management column. Add employees by typing their name in the search field.</li>
          </ul>
          <p>Click <strong>Save</strong>. Changes apply on the next event.</p>
        </section>

        <section>
          <h2>45. Platform Integrations</h2>
          <GuideImage src="/guide/15-platform-integrations.png" alt="Platform Integrations" caption="Platform Integrations panel — Breezy HR, Indeed, LinkedIn Recruiter, Handshake, EmployFL, Jobing, Google Calendar." />

          <h3>How to connect each</h3>
          <table>
            <thead><tr><th>Platform</th><th>Connect method</th></tr></thead>
            <tbody>
              <tr><td><strong>LinkedIn Recruiter</strong></td><td>OAuth — &quot;Sign in with LinkedIn&quot;. Requires admin seat.</td></tr>
              <tr><td><strong>Indeed</strong></td><td>Via Unified.to. The integration key + Indeed connection ID are stored as platform credentials.</td></tr>
              <tr><td><strong>Breezy HR</strong></td><td>Email + password. Talk to your Breezy admin. The platform signs in on every cron sync (token refreshed). Requires a Breezy plan with API access.</td></tr>
              <tr><td><strong>Jobing</strong></td><td>API token via pro.jobing.com / NOLIG.</td></tr>
              <tr><td><strong>Handshake</strong> / <strong>EmployFL</strong></td><td>OAuth login from the panel.</td></tr>
              <tr><td><strong>Google Calendar</strong></td><td>OAuth — adds calendar.events scope. Used for interview + 1:1 events with auto-Meet links.</td></tr>
            </tbody>
          </table>

          <h3>Auto-sync</h3>
          <p>A Railway cron runs every 5 minutes hitting <code>/api/cron/sync-platforms</code>. For each Active platform with credentials, it pulls every candidate from the platform&apos;s API into our database, downloads their resume PDFs locally, and links them to the right Position via the Breezy externalId mapping.</p>

          <h3>Manual sync</h3>
          <p>Each platform row has a <strong>Sync now</strong> button if you want to pull immediately without waiting for the next cron tick.</p>
        </section>

        <section>
          <h2>46. Roles &amp; Permissions</h2>
          <p><span className="role-pill">SUPER_ADMIN</span> only. Lets you toggle which permissions each non-super-admin role has (Admin, HR, Manager, Employee). Super Admin always has everything and cannot be edited.</p>
          <p>Permissions are checked at server-action level — toggling a permission off immediately blocks the action for that role.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>47. Audit Log</h2>
          <p><span className="role-pill">SUPER_ADMIN</span> only. Sidebar → <strong>Audit Log</strong>.</p>
          <GuideImage src="/guide/08-audit-log.png" alt="Audit Log" caption="Audit Log — filter by action, actor email, entity type. Each row has timestamp, actor, action name, entity, JSON details." />

          <h3>What gets logged</h3>
          <ul>
            <li><code>auth.login</code> — every sign-in (with provider).</li>
            <li><strong>User events</strong>: <code>user.invited</code>, <code>user.role.changed</code> (from/to), <code>user.password.set</code>, <code>user.deleted</code>.</li>
            <li><strong>Employee events</strong>: <code>employee.created</code>, <code>employee.updated</code>, <code>employee.promoted</code> (from job title → to job title), <code>employee.offboarding_started</code>, <code>employee.archived</code> (with reason), <code>employee.restored</code>, <code>employee.purged</code>.</li>
            <li><strong>Candidate events</strong>: <code>candidate.status.changed</code> (with from/to + <code>via</code> field: kanban / adverse-action-letter / mark-do-not-call), <code>candidate.deleted</code>.</li>
            <li><strong>Position events</strong>: <code>position.status.changed</code>, <code>position.posted_to_breezy</code> (with externalId).</li>
          </ul>

          <h3>Filtering</h3>
          <ul>
            <li><strong>All actions</strong> dropdown — pick one action type.</li>
            <li><strong>Actor email</strong> — case-insensitive substring match (e.g. <code>bar@</code>).</li>
            <li><strong>Entity type</strong> — e.g. <code>candidate</code>, <code>employee</code>, <code>user</code>.</li>
            <li><strong>Clear</strong> button when any filter is active.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>48. Privacy &amp; visibility rules</h2>
          <ul>
            <li>Employees cannot view other employees&apos; profiles — only their own.</li>
            <li>Managers see direct reports&apos; profiles.</li>
            <li>HR &amp; admin see everyone.</li>
            <li>HR_ONLY documents are filtered from My Documents and the employee&apos;s own profile widget. The file-serving route also rejects unauthorized fetches.</li>
            <li>HR Notes are admin/HR-only end to end.</li>
            <li>Anniversary review events on the Calendar are scoped: admin/HR see all, manager sees own + reports, employee sees only their own.</li>
            <li>Emergency contact only renders to admin, the employee, or their direct manager.</li>
            <li>1:1 notebook history visible only to admin/HR, the employee, and their manager.</li>
            <li>Pulse responses are anonymous — only aggregates are exposed.</li>
            <li>Background check report PDFs are gated to admin/HR/manager and proxied through our server so the provider API key never reaches the browser.</li>
          </ul>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>49. Integrations (deep dive)</h2>
          <table>
            <thead><tr><th>Service</th><th>What it does &amp; how it&apos;s configured</th></tr></thead>
            <tbody>
              <tr><td><strong>Breezy HR</strong></td><td>Source &amp; post integration. Sync runs every 5 min via Railway cron, pulling new applicants and downloading resume PDFs. Position posting reuses externalId so clicking &quot;Post to Breezy&quot; multiple times republishes instead of duplicating.</td></tr>
              <tr><td><strong>backgroundchecks.com</strong></td><td>Order creation, status polling, PDF report streaming. API key in env: <code>BACKGROUND_CHECK_API_KEY</code>.</td></tr>
              <tr><td><strong>Google Calendar</strong></td><td>OAuth per user. Interviews + 1:1s get a Meet link automatically. Each user&apos;s personal events overlay on /calendar (private — only the owner sees their own).</td></tr>
              <tr><td><strong>Gusto</strong></td><td>Payroll integration. Pulls compensation + tax info into the People tab for each employee.</td></tr>
              <tr><td><strong>Resend</strong></td><td>Email provider. Every transactional email goes through Resend. Domain must be verified.</td></tr>
              <tr><td><strong>Jobing / NOLIG</strong></td><td>Read-only sync of applicants from pro.jobing.com.</td></tr>
              <tr><td><strong>LinkedIn Recruiter</strong></td><td>Pulls senior candidates from the LinkedIn recruiter pipeline.</td></tr>
              <tr><td><strong>Indeed (via Unified.to)</strong></td><td>Sync candidates &amp; post jobs.</td></tr>
              <tr><td><strong>Handshake / EmployFL</strong></td><td>College graduates / Florida bilingual talent pools.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>50. Public flows: signing &amp; filling</h2>
          <p>These pages don&apos;t require login — the signer just needs the tokenized URL we email them.</p>

          <h3>/sign/[token]</h3>
          <ul>
            <li>Loads the document preview.</li>
            <li>Signer either types their name (rendered in a script font) or draws a signature with mouse/touch.</li>
            <li>Submits. The signed PDF is generated server-side and stored. The platform fires the &quot;Signed&quot; notifications.</li>
            <li>Once status is SIGNED / VOIDED / AWAITING_COUNTERSIGN, the token returns 410 Gone — no more downloads via this link.</li>
          </ul>

          <h3>/fill/[token]</h3>
          <p>Same as sign but for fillable PDFs. Signer enters text into each field, plus signature, then submits. Used for I-9, W-4, contact info forms.</p>

          <h3>/careers</h3>
          <p>Public careers page. Lists every Open + Published position. Click a position → application form. Submissions create a Candidate row with source &quot;careers-page&quot; in the position&apos;s NEW column. HR Team gets notified.</p>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>51. Troubleshooting</h2>
          <table>
            <thead><tr><th>Symptom</th><th>What to do</th></tr></thead>
            <tbody>
              <tr><td>&quot;Already exists&quot; alert when adding a candidate</td><td>Switch to From Database tab and assign the existing candidate to this position.</td></tr>
              <tr><td>Resume PDF returns 403</td><td>The Breezy integration user lacks resume-download permission. Ask a Breezy admin to grant it or reconnect with an admin Breezy account.</td></tr>
              <tr><td>Position duplicated on Breezy</td><td>Was a known bug; fixed. Delete older duplicates directly in the Breezy dashboard.</td></tr>
              <tr><td>Candidate&apos;s &quot;via&quot; source shows &quot;applied&quot;</td><td>Legacy data. Self-corrects on the next cron sync (every 5 min).</td></tr>
              <tr><td>Sync isn&apos;t running</td><td>Check the Railway cron service (<code>hr-cron-sync</code>) is Active and the schedule is <code>*/5 * * * *</code>.</td></tr>
              <tr><td>&quot;Server Components render&quot; error popup</td><td>Hard-reload the page (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>). If it persists, share the URL.</td></tr>
              <tr><td>BG Check &quot;View Report&quot; returns 502</td><td>The report may not be finalized yet, or backgroundchecks.com uses a non-standard PDF path for your account. Try Refresh Status first; if still failing, view the report in their dashboard.</td></tr>
              <tr><td>Can&apos;t see a colleague&apos;s profile</td><td>Intentional. Only admins/HR, the employee themselves, and their direct manager can view a profile.</td></tr>
              <tr><td>&quot;Adding…&quot; button stuck</td><td>Hard-reload — your browser may be running an old JS bundle.</td></tr>
              <tr><td>Cron service shows Crashed</td><td>Open the Deploy Logs of the cron service. Common: malformed Custom Start Command (URL has stray space/newline). Re-paste the curl command cleanly.</td></tr>
              <tr><td>Email never arrives</td><td>Check Resend dashboard for bounces. Sender domain must be verified.</td></tr>
            </tbody>
          </table>
        </section>

        {/* ============================================================ */}
        <section>
          <h2>52. Glossary &amp; FAQ</h2>
          <h3>Glossary</h3>
          <table>
            <thead><tr><th>Term</th><th>Meaning</th></tr></thead>
            <tbody>
              <tr><td>Pipeline</td><td>The sequence of stages a candidate passes through (NEW → SCREENING → INTERVIEW → … → HIRED).</td></tr>
              <tr><td>Source</td><td>Where a candidate came from (Indeed, LinkedIn, careers-page, referral, etc.).</td></tr>
              <tr><td>Stage</td><td>A column on the kanban. Same as Status.</td></tr>
              <tr><td>Audit Log</td><td>Append-only record of who did what, when.</td></tr>
              <tr><td>Pre-onboarding</td><td>Tasks completed before the start date (e.g. signing initial docs).</td></tr>
              <tr><td>Onboarding</td><td>Tasks from start date until the employee is fully Active.</td></tr>
              <tr><td>HR Team</td><td>Configurable group of employees who receive notifications when &quot;HR Team&quot; is enabled per action.</td></tr>
              <tr><td>Management Group</td><td>Same idea, for the Management column.</td></tr>
              <tr><td>Adverse Action Letter</td><td>FCRA-mandated rejection letter sent when a candidate fails background check.</td></tr>
              <tr><td>Countersign</td><td>A second signature required after the primary signer signs (e.g. HR signs off on a contract the employee signed).</td></tr>
              <tr><td>Externall ID</td><td>The identifier on an external platform (Breezy positionId, backgroundchecks.com reportKey).</td></tr>
            </tbody>
          </table>

          <h3>FAQ</h3>
          <ul>
            <li><strong>Can I undo deleting an employee?</strong> Yes — go to /people/archive and click Restore.</li>
            <li><strong>Can I see who moved a candidate?</strong> Yes — Audit Log → filter by action <code>candidate.status.changed</code>.</li>
            <li><strong>Why don&apos;t employees see /people in their sidebar?</strong> Privacy. Only manager+ can browse the directory.</li>
            <li><strong>Can I customize the careers page?</strong> The page automatically lists every Open + Published position. Logo + company colors come from Settings → Company Information.</li>
            <li><strong>How often does Breezy sync?</strong> Every 5 minutes (configurable in Railway cron).</li>
            <li><strong>Where does email go from?</strong> <code>hrteam@hr.coastaldebt-tools.com</code> via Resend. Configurable in Settings.</li>
          </ul>
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
