# Google Calendar mentoring setup

Strativate stores mentoring enrollment, topic, mentor assignment, schedule, managed Zoom-room assignment, and status in Supabase. Google Calendar handles OAuth, mentor free/busy, and event creation, updates, and cancellation. It does not create a conferencing link. Refresh tokens are encrypted server-side and are never returned to browser code.

## Google Cloud setup

1. Enable the Google Calendar API in the Strativate Google Cloud project.
2. Configure Google Auth Platform / OAuth consent with the application identity and support details.
3. While the OAuth app is in Testing, add each Calendar account under **Audience → Test users**.
4. For managed Google Workspace accounts, allow the requested Calendar scopes.

If Google returns `403 access_denied`, check the test-user list, enabled API, Workspace policy, and deployed OAuth configuration.

## OAuth client

Register the exact callback URI used by the deployment, for example:

- Development: `http://localhost:3000/api/google-calendar/callback`
- Production: `https://strativate.vercel.app/api/google-calendar/callback`
- Custom domain: `https://strativate.id/api/google-calendar/callback`

The selected URI must equal `GOOGLE_OAUTH_REDIRECT_URI`.

## Scopes

- Admin: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`
- Mentor: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`
- Mentee: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`

Admin creates, updates, and cancels the canonical mentoring event. Mentor and mentee free/busy remains privacy-sanitized.

## Server environment

```text
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://strativate.vercel.app/api/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=...
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` must decode to 32 bytes. Existing encrypted refresh tokens depend on it. Zoom OAuth environment variables are not used.

## Event lifecycle

1. Admin schedules a session; the database atomically reserves one available managed Zoom room for the full interval.
2. Google Calendar creates or updates the event with the effective meeting URL and existing attendee behavior.
3. Rescheduling updates the room reservation and the same Google event identity.
4. Editing a managed room URL or changing a session room updates the effective URL and reconciles the event.
5. A manual meeting URL takes precedence in Calendar while the managed room remains reserved.
6. Cancellation releases the room and cancels the Google event. Completed and cancelled sessions do not expose an active join link.

Legacy scheduled sessions retain their old generated Zoom URL as a manual link until Admin assigns a managed room. See [managed Zoom rooms](zoom-google-calendar-setup.md) for room administration.
