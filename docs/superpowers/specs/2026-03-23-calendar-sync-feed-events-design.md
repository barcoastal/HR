# Calendar Sync + Feed Events — Design Spec

## Goal

Enable per-user Google Calendar two-way sync (pull Google events into CALATRAVA calendar, push RSVP'd events back), add event creation to the feed with RSVP tracking, and send email notifications for all new feed posts via Resend.

## Constraints

- Per-user Google Calendar OAuth2 (each employee connects their own Google account)
- Two-way sync: Google events fetched live (not stored), CALATRAVA events pushed on RSVP
- Google Calendar events are private — only visible to the user who synced them
- Any employee can create events in the feed
- Email notifications for all new feed posts, with opt-out per user
- Reuse existing Google OAuth credentials (`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`)
- Reuse existing Resend email infrastructure (`src/lib/email.ts`)
- Reuse existing encryption pattern (AES-256-GCM) — extract to shared module

---

## Architecture

### Per-User Google Calendar OAuth Flow

1. User clicks "Connect Google Calendar" on calendar page or profile
2. `GET /api/calendar/google/authorize` generates CSRF state, redirects to Google OAuth consent screen
3. Scopes requested: `calendar.readonly`, `calendar.events`
4. Google redirects back to `GET /api/calendar/google/callback`
5. Callback validates state, exchanges code for tokens, encrypts and stores on User model
6. Sets `googleCalendarSyncEnabled = true`

Token management reuses the same AES-256-GCM encryption pattern as Gusto. Extract encryption helpers from `src/lib/gusto.ts` into a shared `src/lib/encryption.ts` module. Auto-refresh tokens before expiry using the same mutex pattern.

### Two-Way Sync

**Pull (Google → CALATRAVA):**
- When rendering the calendar page, fetch the user's Google Calendar events for the visible date range via Google Calendar API (`GET /calendars/primary/events`)
- Events are fetched live — not stored in DB
- Rendered with distinct styling (e.g., green) alongside CALATRAVA events

**Push (CALATRAVA → Google):**
- When a user marks "Going" on a feed event and has Google Calendar connected, create a Google Calendar event via `POST /calendars/primary/events`
- Store the returned `googleCalendarEventId` on the EventAttendance row for updates/deletion
- If user changes to "Not Going", delete the event from their Google Calendar
- "Maybe" does NOT push to Google Calendar

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
```

### Modify FeedPostType enum

Add `EVENT` to the existing enum:
```prisma
enum FeedPostType {
  GENERAL
  SHOUTOUT
  EVENT    // new
}
```

### Modify FeedPost model

Add nullable event fields:
```prisma
eventDate     DateTime?  // event start date/time
eventEndDate  DateTime?  // event end date/time
eventLocation String?    // physical address or virtual link
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
}

enum AttendanceStatus {
  GOING
  MAYBE
  NOT_GOING
}
```

---

## Features

### 1. Google Calendar Connection (Calendar Page + Profile)

- **Connect button**: On calendar page header and user profile — initiates per-user OAuth flow
- **Connection status**: Shows "Connected" with Google account info, or "Not connected"
- **Disconnect button**: Clears tokens, disables sync. Confirmation dialog before executing.

### 2. Calendar Page — Enhanced (`/calendar`)

Existing content (employee birthdays, work anniversaries, holidays, interviews) plus:
- **Feed events**: All FeedPost entries with `type: EVENT` appear on their `eventDate`
- **Google Calendar events**: If user has sync enabled, their Google Calendar events appear with distinct styling (green)
- Visual legend indicating event source colors

### 3. Feed Events — Create + RSVP (`/feed`)

**Creating events:**
- "Create Event" button alongside existing "Create Post"
- Form: title (content field), date/time, end date/time, location (optional)
- Creates FeedPost with `type: EVENT`

**Event card in feed:**
- Shows: title, date/time, location, attendee count + avatars, RSVP buttons
- Three RSVP options: Going, Maybe, Not Going (default: no response)
- Supports existing reactions and comments

**RSVP + Calendar push:**
- "Going" → creates EventAttendance row + pushes to Google Calendar (if connected)
- "Maybe" → creates EventAttendance row, does NOT push to Google Calendar
- "Not Going" → updates attendance + deletes from Google Calendar if previously pushed
- No response → not in EventAttendance table

### 4. Email Notifications for Feed Posts

**Trigger:** Every new FeedPost (all types — GENERAL, SHOUTOUT, EVENT) sends an email to all employees with `emailNotificationsEnabled = true`.

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
- Batch send via Resend

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
  → GET /api/calendar/google/authorize (generate state, redirect to Google)
  → Google consent screen → user approves
  → GET /api/calendar/google/callback (validate state, exchange code)
  → Encrypt tokens, store on User model
  → Set googleCalendarSyncEnabled = true
```

### Feed Event Creation
```
User fills event form (title, date, location)
  → createFeedEvent server action
  → Creates FeedPost with type: EVENT
  → Async: send email notification to all opted-in employees
  → Event appears in feed and on calendar
```

### RSVP + Calendar Push
```
User clicks "Going" on event
  → upsertEventAttendance server action (status: GOING)
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
      → Fetch Google Calendar events for date range (live API call)
  → Render all events with source-specific styling
```

---

## API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/calendar/google/authorize` | Initiate per-user Google Calendar OAuth |
| `GET /api/calendar/google/callback` | Handle OAuth callback, store encrypted tokens |
| Server actions in `src/lib/actions/calendar-sync.ts` | Connect/disconnect, fetch Google events, sync status |
| Server actions in `src/lib/actions/feed-events.ts` | Create event, RSVP, get attendees |
| Modified `src/lib/actions/feed.ts` | Trigger email on new post |

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/lib/encryption.ts` (extract AES-256-GCM helpers from gusto.ts, shared) |
| Create | `src/lib/google-calendar-sync.ts` (per-user Google Calendar API: fetch events, push/delete, token refresh) |
| Create | `src/app/api/calendar/google/authorize/route.ts` (initiate per-user OAuth) |
| Create | `src/app/api/calendar/google/callback/route.ts` (handle OAuth callback, store tokens) |
| Create | `src/lib/actions/calendar-sync.ts` (server actions: connect/disconnect, get Google events, sync status) |
| Create | `src/lib/actions/feed-events.ts` (server actions: create event, RSVP, get attendees) |
| Create | `src/components/feed/event-card.tsx` (event post card with RSVP buttons, attendees) |
| Create | `src/components/feed/create-event-dialog.tsx` (event creation form) |
| Create | `src/components/calendar/google-calendar-connect.tsx` (connect/disconnect button) |
| Modify | `src/lib/gusto.ts` (remove encryption helpers, import from shared encryption.ts) |
| Modify | `src/lib/email.ts` (add sendFeedPostNotification function) |
| Modify | `src/lib/actions/feed.ts` (trigger email notification on new post creation) |
| Modify | `prisma/schema.prisma` (User fields, FeedPostType enum, FeedPost event fields, EventAttendance model) |
| Modify | `src/app/(dashboard)/calendar/page.tsx` (show Google Calendar events + feed events, connect button) |
| Modify | Feed page/components (add "Create Event" button, render event cards) |
| Modify | `src/components/feed/feed-post-card.tsx` (handle EVENT type rendering) |
| Modify | User profile/settings (add email notification toggle + Google Calendar connect) |
