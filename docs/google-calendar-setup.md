# Google Calendar + Google Meet setup

Strativate keeps mentoring enrollment, focus, mentor assignment, schedule, and status in Supabase. Google Calendar is an integration layer only. OAuth refresh tokens are encrypted server-side and are never returned to browser code.

## 1. Create/choose a Google Cloud project

1. Open Google Cloud Console and choose the project used by Strativate.
2. Enable **Google Calendar API**.
3. Configure the OAuth consent screen with the Strativate application identity and support/contact information.
4. If the consent screen is still in Testing, add the admin, mentor, and mentee Google accounts used for smoke testing as test users.

## 2. Create an OAuth 2.0 Web application

Create a **Web application** OAuth client. Add exact callback URLs under **Authorized redirect URIs**:

- Development: `http://localhost:3000/api/google-calendar/callback`
- Production: `https://strativate.id/api/google-calendar/callback`
- Add the deployed Vercel/custom-domain callback too if production is served from a different canonical host.

The configured URI must exactly match `GOOGLE_OAUTH_REDIRECT_URI` for that deployment.

## 3. Scopes used by Strativate

The application requests only the role-specific Calendar permissions needed by the current product flow:

- Admin: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`
- Mentor: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`
- Mentee: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy` (untuk conflict warning tanpa detail event)

Admin Calendar access is used to create/update the canonical mentoring event and Google Meet. Mentor FreeBusy is converted to sanitized busy intervals; event titles/descriptions/attendees are never returned to the admin scheduler.

## 4. Environment variables

Set these as server-only secrets in local `.env.local` and each deployment environment:

```text
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=...
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` must decode to exactly 32 bytes. One safe generation command is `openssl rand -base64 32`. Do not rotate it without a token re-encryption/migration plan because existing refresh-token ciphertext depends on it.

## 5. Database migration

Apply the normal Supabase migration pipeline after deploying `202609150004_google_calendar_mentoring_scheduling.sql`. Do not edit prior migrations. The migration adds server-only Google connection/state tables, per-session calendar integration metadata, role-isolated scheduling/calendar RPCs, and a mentor schedule exclusion constraint.

## 6. Connect / disconnect behavior

Each signed-in Admin, Mentor, or Mentee connects Google Calendar from their Calendar/Jadwal screen. This OAuth permission is independent from the user’s Strativate login provider.

Disconnect removes the stored refresh credential and best-effort revokes it at Google. Disconnecting never deletes the Strativate mentoring session or its canonical schedule. To revoke outside Strativate, users can also remove Strativate access from their Google Account third-party access/security settings, then use **Reconnect** in Strativate.

## 7. Google Meet generation

Google Meet is created by Calendar event conference data (`conferenceData.createRequest` with `conferenceDataVersion=1`). Conference creation can be asynchronous; a session can therefore be scheduled while sync is still `pending`. Retry sync updates the same deterministic Google event rather than creating a second invitation.

## 8. Manual production smoke test

With legitimate test credentials configured:

1. Connect an Admin Google Calendar.
2. Connect a Mentor Calendar, create a private Google event inside a declared availability window, and verify Admin sees the affected slot as unavailable without seeing the event title.
3. Connect a Mentee Calendar (optional for booking) and verify a conflict warning appears without exposing the event title to Admin.
4. Pick a focus as Mentee, schedule from Admin, and verify one Calendar event plus one Meet is created and invited to mentor + mentee.
5. Re-open scheduling, reschedule or change mentor, and verify the same Google event ID is updated rather than duplicated.
6. Verify Admin, Mentor, and Mentee Calendar screens show the Strativate session once (deduplicated from its Google mirror).
7. Override the meeting link, reschedule, and verify the override is preserved; reset it to return to the generated Meet.
8. Revoke the Google grant and verify Strativate still shows its DB schedule, exposes a reconnect/error state, and allows Admin retry after reconnect.
