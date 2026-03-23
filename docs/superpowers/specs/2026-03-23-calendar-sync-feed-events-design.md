# Calendar Sync + Feed Events — Design Spec

## Goal

Enable per-user Google Calendar two-way sync (pull Google events into CALATRAVA calendar, push RSVP'd events back), add event creation to the feed with RSVP tracking, and send email notifications for user-created feed posts via Resend.

## Constraints

- Per-user Google Calendar OAuth2 (each employee connects their own Google account)
- Two-way sync: Google events fetched live (not stored), CALATRAVA events pushed on RSVP
- Google Calendar events are private — only visible to the user who synced them
- Any employee can create events in the feed
- Email notifications for user-created feed posts (GENERAL, SHOUTOUT, EVENT), with opt-out per user
- Reuse existing Google OAuth credentials (`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`)
- Reuse existing OAuth infrastructure (`/api/platforms/[provider]/authorize` and `/api/platforms/[provider]/callback`)
- Reuse existing Resend email infrastructure (`src/lib/email.ts`)
- Reuse existing encryption pattern (AES-256-GCM) — extract to shared module
- System-level Google Calendar connection for interviews (`RecruitmentPlatform`) continues to exist alongside per-user connections — same OAuth client credentials, different token storage

---

## Architecture

### Per-User Google Calendar OAuth Flow

Reuses the existing OAuth infrastructure (`/api/platforms/[provider]/authorize`, `/api/platforms/[provider]/callback`):

1. User clicks "Connect Google Calendar" on calendar page or profile
2. Link includes query param: `/api/platforms/google_calendar/authorize?mode=personal`
3. Authorize route reads `mode` query param, passes it to `createOAuthState` which stores it in the new `metadata` JSON field on `OAuthState`
4. Generates CSRF state, redirects to Google OAuth consent screen
5. Scopes (already registered in `OAUTH_PROVIDERS`): `https://www.googleapis.com/auth/calendar.events` (read+write), `https://www.googleapis.com/auth/userinfo.email`
6. Google redirects back to `GET /api/platforms/google_calendar/callback`
7. **Callback branching**: `validateAndConsumeState` now returns `metadata` alongside existing fields. When `providerId === 'google_calendar'` AND `metadata.mode === 'personal'`, call `handleGoogleCalendarCallback(tokens, stateData)` (exported from `src/lib/google-calendar-sync.ts`). The handler: encrypts tokens, stores on User model, sets `googleCalendarSyncEnabled = true`. When `mode` is absent (legacy/system-level connect), fall through to the existing `RecruitmentPlatform` upsert — preserving backward compatibility with the interview scheduling flow.

**OAuth infrastructure changes required:**
- Add `metadata Json?` field to `OAuthState` model in Prisma schema
- Update `createOAuthState(providerId, userId, metadata?)` to accept optional metadata parameter
- Update `validateAndConsumeState` return type to include `metadata: Record<string, unknown> | null`
- Update authorize route to read `mode` query param and pass `{ mode }` as metadata

Token management reuses the same AES-256-GCM encryption pattern as Gusto. Extract encryption helpers from `src/lib/gusto.ts` into a shared `src/lib/encryption.ts` module, using the same `GUSTO_ENCRYPTION_KEY` env var (renamed semantically to `ENCRYPTION_KEY` in the shared module, with fallback to `GUSTO_ENCRYPTION_KEY` for backward compatibility: `process.env.ENCRYPTION_KEY || process.env.GUSTO_ENCRYPTION_KEY`). Auto-refresh tokens before expiry using the same mutex pattern (keyed per user to avoid cross-user locking).

### Two-Way Sync

**Pull (Google → CALATRAVA):**
- When rendering the calendar page, fetch the user's Google Calendar events for the visible date range via Google Calendar API (`GET /calendars/primary/events`)
- Events are fetched live — not stored in DB
- Rendered with distinct styling (e.g., green) alongside CALATRAVA events

**Push (CALATRAVA → Google):**
- When a user marks "Going" on a feed event and has Google Calendar connected, create a Google Calendar event via `POST /calendars/primary/events`
- Store the returned `googleCalendarEventId` on the EventAttendance row for updates/deletion
- If user changes to "Not Going", delete the event from their Google Calendar
- "Maybe" does NOT push to Google Calendar — but the event still appears on the user's CALATRAVA calendar view (they expressed interest)

**Disconnect:**
- User can disconnect from profile or calendar page
- Clears tokens, sets `googleCalendarSyncEnabled = false`
- Does NOT delete previously pushed events from Google Calendar

---

## Database Changes

### Modify User model

Add fields:
```prisma
googleCalendarAccessToken  String?   // AES-256-GCM encrypted
googleCalendarRefreshToken String?   // AES-256-GCM encrypted
googleCalendarTokenExpiresAt DateTime?
googleCalendarSyncEnabled  Boolean  @default(false)
emailNotificationsEnabled  Boolean  @default(true)
eventAttendances           EventAttendance[]  // back-relation
```

### Modify OAuthState model

Add metadata field for extensible OAuth state data:
```prisma
metadata Json?  // Optional JSON for provider-specific state (e.g., { mode: "personal" })
```

### Modify FeedPostType enum

Add `EVENT` to the existing enum (full enum shown for clarity):
```prisma
enum FeedPostType {
  ANNOUNCEMENT
  GENERAL
  BIRTHDAY
  ANNIVERSARY
  NEW_HIRE
  DEPARTURE
  SHOUTOUT
  EMERGENCY
  EVENT        // new
}
```

### Modify FeedPost model

Add nullable event fields (application-level validation ensures these are required when `type = EVENT`):
```prisma
eventDate     DateTime?  // event start date/time
eventEndDate  DateTime?  // event end date/time
eventLocation String?    // physical address or virtual link
```

Add relation:
```prisma
attendees     EventAttendance[]
```

### New model: EventAttendance

```prisma
model EventAttendance {
  id                    String   @id @default(uuid())
  feedPostId            String
  feedPost              FeedPost @relation(fields: [feedPostId], references: [id], onDelete: Cascade)
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  status                AttendanceStatus
  googleCalendarEventId String?  // ID of pushed Google Calendar event, for updates/deletion
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([feedPostId, userId])
  @@index([userId])  // for "get all events a user is attending" queries
}

enum AttendanceStatus {
  GOING
  MAYBE
  NOT_GOING
}
```

### ID Convention Note

The FeedPost system is Employee-centric (`FeedPost.authorId` → `Employee.id`), while auth tokens live on the `User` model. `EventAttendance.userId` references `User.id` (since it needs to look up Google Calendar tokens for the push). Server actions that create attendance or send notifications will join through `User.employeeId` ↔ `Employee.id` as needed.

---

## Features

### 1. Google Calendar Connection (Calendar Page + Profile)

- **Connect button**: On calendar page header and user profile — initiates per-user OAuth flow via `/api/platforms/google_calendar/authorize`
- **Connection status**: Shows "Connected" with Google account email (from `userinfo.email` scope), or "Not connected"
- **Disconnect button**: Clears tokens, disables sync. Confirmation dialog before executing.

### 2. Calendar Page — Enhanced (`/calendar`)

Existing content (employee birthdays, work anniversaries, holidays, interviews) plus:
- **Feed events**: All FeedPost entries with `type: EVENT` appear on their `eventDate`
- **Google Calendar events**: If user has sync enabled, their Google Calendar events appear with distinct styling (green). Private to the user — not visible to others.
- Visual legend indicating event source colors

### 3. Feed Events — Create + RSVP (`/feed`)

**Creating events:**
- "Create Event" button alongside existing "Create Post"
- Form: title (content field), date/time, end date/time, location (optional)
- Application-level validation: `eventDate` and `eventEndDate` required when `type = EVENT`
- Creates FeedPost with `type: EVENT`

**Event card in feed:**
- Shows: title, date/time, location, attendee count + avatars, RSVP buttons
- Three RSVP options: Going, Maybe, Not Going (default: no response)
- "Maybe" attendees are included in the attendee count (shown separately, e.g., "5 going, 2 maybe")
- Supports existing reactions and comments

**RSVP + Calendar push:**
- "Going" → creates EventAttendance row + pushes to Google Calendar (if connected)
- "Maybe" → creates EventAttendance row, does NOT push to Google Calendar. Event still visible on user's CALATRAVA calendar.
- "Not Going" → updates attendance + deletes from Google Calendar if previously pushed
- No response → not in EventAttendance table

### 4. Email Notifications for Feed Posts

**Trigger:** User-created feed posts only — types `GENERAL`, `SHOUTOUT`, and `EVENT`. Auto-generated posts (`BIRTHDAY`, `ANNIVERSARY`, `NEW_HIRE`, `DEPARTURE`) and system posts (`ANNOUNCEMENT`, `EMERGENCY`) do NOT trigger email notifications.

**Email content:**
- Regular/Shoutout posts: Subject `New post from {authorName}`, body with post content + "View in App" button
- Event posts: Subject `New event: {title}`, body with date, location, content + "RSVP in App" button
- Uses existing `wrapHtml` branding and Resend infrastructure

**Opt-out:**
- `emailNotificationsEnabled` on User, defaults to `true`
- Toggle in user profile settings
- All-or-nothing (no per-type granularity)

**Performance:**
- Email sending is async — does not block post creation
- Query active employees with email, exclude the post author
- Use `resend.batch.send()` API, chunking recipients into groups of 100 (Resend batch limit). Add a `sendBatchEmail` helper in `src/lib/email.ts`.

### 5. Error & Disconnected States

- **Google Calendar not connected**: Calendar page shows existing events only, with a "Connect Google Calendar" prompt
- **Token expired / refresh failed**: Show "Google Calendar disconnected — please reconnect" banner, set `googleCalendarSyncEnabled = false`
- **Google API errors**: Inline error "Failed to load Google Calendar events" with retry, doesn't break the page
- **Push failures**: If pushing an event to Google Calendar fails, show a toast error but still save the RSVP locally

---

## Data Flows

### Google Calendar Connect
```
User clicks "Connect Google Calendar"
  → GET /api/platforms/google_calendar/authorize (generate state with calendarMode=personal, redirect to Google)
  → Google consent screen → user approves
  → GET /api/platforms/google_calendar/callback (validate state, exchange code)
  → Callback sees calendarMode=personal → calls handleGoogleCalendarCallback
  → Encrypt tokens, store on User model
  → Set googleCalendarSyncEnabled = true
  → Redirect to /calendar with success param
```

### Feed Event Creation
```
User fills event form (title, date, end date, location)
  → createFeedEvent server action
  → Validates eventDate + eventEndDate are present
  → Creates FeedPost with type: EVENT
  → Async: send email notification to all opted-in employees (GENERAL, SHOUTOUT, EVENT only)
  → Event appears in feed and on calendar
```

### RSVP + Calendar Push
```
User clicks "Going" on event
  → upsertEventAttendance server action (status: GOING)
  → Look up User (via session) for Google Calendar tokens
  → If user.googleCalendarSyncEnabled:
      → Push event to Google Calendar API
      → Store googleCalendarEventId on EventAttendance
  → Update attendee count on event card

User changes to "Not Going"
  → upsertEventAttendance server action (status: NOT_GOING)
  → If googleCalendarEventId exists:
      → Delete event from Google Calendar API
      → Clear googleCalendarEventId
```

### Calendar Page Rendering
```
User visits /calendar
  → Fetch existing CALATRAVA events (birthdays, holidays, interviews)
  → Fetch FeedPost events (type: EVENT) for date range
  → If googleCalendarSyncEnabled:
      → Fetch Google Calendar events for date range (live API call using User's tokens)
  → Render all events with source-specific styling
```

---

## API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/platforms/google_calendar/authorize` | Initiate per-user Google Calendar OAuth (existing dynamic route, state includes `calendarMode=personal`) |
| `GET /api/platforms/google_calendar/callback` | Handle OAuth callback — new `google_calendar` branch for per-user token storage |
| Server actions in `src/lib/actions/calendar-sync.ts` | Connect/disconnect, fetch Google events, sync status |
| Server actions in `src/lib/actions/feed-events.ts` | Create event, RSVP, get attendees |
| Modified `src/lib/actions/feed.ts` | Trigger email on new post |

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/lib/encryption.ts` (extract AES-256-GCM helpers from gusto.ts, shared) |
| Create | `src/lib/google-calendar-sync.ts` (per-user Google Calendar API: fetch events, push/delete, token refresh, handleGoogleCalendarCallback) |
| Create | `src/lib/actions/calendar-sync.ts` (server actions: connect/disconnect, get Google events, sync status) |
| Create | `src/lib/actions/feed-events.ts` (server actions: create event, RSVP, get attendees) |
| Create | `src/components/feed/event-card.tsx` (event post card with RSVP buttons, attendees) |
| Create | `src/components/feed/create-event-dialog.tsx` (event creation form) |
| Create | `src/components/calendar/google-calendar-connect.tsx` (connect/disconnect button) |
| Modify | `src/lib/gusto.ts` (remove encryption helpers, import from shared encryption.ts) |
| Modify | `src/lib/email.ts` (add sendFeedPostNotification + sendBatchEmail functions) |
| Modify | `src/lib/actions/feed.ts` (trigger email notification on new user-created post) |
| Modify | `prisma/schema.prisma` (User fields + back-relation, OAuthState metadata field, FeedPostType enum + EVENT, FeedPost event fields + attendees relation, EventAttendance model) |
| Modify | `src/lib/oauth/utils.ts` (update createOAuthState + validateAndConsumeState for metadata param) |
| Modify | `src/app/api/platforms/[provider]/authorize/route.ts` (read mode query param, pass as metadata) |
| Modify | `src/app/api/platforms/[provider]/callback/route.ts` (add google_calendar branch with mode=personal check) |
| Modify | `src/app/(dashboard)/calendar/page.tsx` (show Google Calendar events + feed events, connect button) |
| Modify | Feed page/components (add "Create Event" button, render event cards) |
| Modify | `src/components/feed/feed-post-card.tsx` (handle EVENT type rendering) |
| Modify | User profile/settings (add email notification toggle + Google Calendar connect) |
