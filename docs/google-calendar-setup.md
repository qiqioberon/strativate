# Google Calendar + Zoom mentoring setup

Strativate keeps mentoring enrollment, topic/scope, mentor assignment, schedule, and status in Supabase. Google Calendar is the scheduling/calendar integration layer. **Zoom is the video-meeting provider for new mentoring sessions.** Historical Google Meet sessions remain valid and are not migrated automatically.

OAuth refresh tokens are encrypted server-side and are never returned to browser code.

## 1. Google Cloud setup

1. Choose the Google Cloud project used by Strativate.
2. Enable **Google Calendar API**.
3. Configure Google Auth Platform / OAuth consent with Strativate application identity and support information.
4. If the OAuth app is still in Testing, add every account used for Calendar smoke testing under **Test users**.
5. For managed Google Workspace accounts, ensure the organization allows the requested Calendar scopes.

### OAuth 403 checklist

If Google returns `403 access_denied`, verify the authorization configuration in this order:

1. Open **Google Auth Platform → Audience → Test users** and add the exact Google accounts used for testing while the app remains in Testing.
2. Confirm Google Calendar API is enabled in the same project as the configured OAuth client.
3. For managed Google Workspace accounts, confirm the administrator allows the requested third-party Calendar scopes.
4. After changing Google OAuth or Vercel environment configuration, **redeploy the production deployment** so the running server receives the updated values.

## 2. OAuth Web application

Create a Web application OAuth client and register the exact callback URI used by the deployment:

- Development: `http://localhost:3000/api/google-calendar/callback`
- Vercel example: `https://strativate.vercel.app/api/google-calendar/callback`
- Custom domain: `https://strativate.id/api/google-calendar/callback`

The selected URI must exactly match `GOOGLE_OAUTH_REDIRECT_URI`.

## 3. Google scopes

Role-specific scopes remain:

- Admin: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`
- Mentor: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`
- Mentee: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`

Admin Calendar access creates/updates/deletes the canonical mentoring event. New events do **not** request `conferenceData` and do not create Google Meet. The current effective Zoom/manual meeting URL is written into the event description. Mentor/Mentee free-busy remains privacy-sanitized.

## 4. Environment variables

Server-only:

```text
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://strativate.vercel.app/api/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=...
```

`GOOGLE_TOKEN_ENCRYPTION_KEY` must decode to 32 bytes. Existing encrypted refresh tokens depend on it.

## 5. First-time onboarding

After mentee onboarding completes, Strativate offers Google Calendar authorization before entering the dashboard. This is optional:

- Connect uses the same PKCE/state flow as dashboard reconnect.
- Skip continues to the dashboard.
- Consent denial returns to onboarding and does not block account registration.
- Connect/Reconnect remains available from dashboard Calendar.

Refresh tokens are stored only after an authenticated Strativate user is known.

## 6. Event lifecycle

For a newly scheduled mentoring session:

1. Strativate validates/reserves the DB schedule.
2. Zoom meeting is created/reconciled.
3. The Zoom join URL is persisted on the existing session integration row.
4. Google Calendar creates/updates the deterministic event identity.
5. Calendar event description includes the effective Zoom/manual URL.
6. Reschedule updates the same Zoom meeting ID and same Google event ID.
7. Cancellation reconciles Zoom and Google Calendar independently; partial provider failures remain retryable.

Historical sessions whose stored provider URL is Google Meet remain `google_meet` and keep their existing Calendar/Meet identities.

## 7. Manual smoke test

With legitimate test credentials:

1. Connect Admin Google Calendar.
2. Connect Mentor Calendar and verify private events only affect free/busy, not titles/details shown to Admin.
3. Connect or skip Mentee Calendar; verify denial/skip does not block the account.
4. Complete Private Mentoring competition + topic data and schedule a new session.
5. Verify one Zoom meeting is created and one Google Calendar event is created with the Zoom URL.
6. Verify no Google Meet is generated for the new session.
7. Reschedule and verify the same Zoom meeting ID and Google event ID remain.
8. Set a manual override and verify Admin/Mentor/Mentee plus the Calendar event use the effective override.
9. Reset override and verify all surfaces return to the Zoom provider URL.
10. Cancel and verify Join Meeting is removed; independently retry Zoom or Calendar if one provider failed.
