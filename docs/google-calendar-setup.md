# Google Calendar + Zoom mentoring setup

Strativate keeps mentoring enrollment, topic/scope, mentor assignment, schedule, and status in Supabase. **Zoom is the sole mentoring video provider.** Google Calendar is retained only for OAuth, free-busy/availability, and event create/update/delete synchronization. Google Meet is unsupported as an active mentoring provider.

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
4. After changing Google OAuth or Vercel environment configuration, redeploy the production deployment so the running server receives the updated values.

## 2. OAuth Web application

Register the exact callback URI used by the deployment:

- Development: `http://localhost:3000/api/google-calendar/callback`
- Production: `https://strativate.vercel.app/api/google-calendar/callback`
- Custom domain example: `https://strativate.id/api/google-calendar/callback`

The selected URI must exactly match `GOOGLE_OAUTH_REDIRECT_URI`.

## 3. Google scopes

- Admin: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events`
- Mentor: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`
- Mentee: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.readonly`, `https://www.googleapis.com/auth/calendar.freebusy`

Admin Calendar access creates/updates/deletes the canonical mentoring event. Strativate does **not** request Google conference data and does not create Google Meet. Mentor/Mentee free-busy remains privacy-sanitized.

## 4. Environment variables

```text
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://strativate.vercel.app/api/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=...
```

All are server-only. `GOOGLE_TOKEN_ENCRYPTION_KEY` must decode to 32 bytes because existing encrypted refresh tokens depend on it.

## 5. First-time onboarding

After mentee onboarding completes, Strativate offers Google Calendar authorization before entering the dashboard. This is optional. Connect uses the same PKCE/state flow as dashboard reconnect, Skip continues to the dashboard, and consent denial does not block account registration.

## 6. Event lifecycle

For a newly scheduled mentoring session:

1. Strativate validates/reserves the DB schedule.
2. Zoom is created/reconciled idempotently.
3. The Zoom meeting ID and join URL are persisted.
4. Google Calendar creates or updates the deterministic event identity.
5. The event description includes the effective Zoom/manual override URL.
6. Reschedule updates the same Zoom meeting ID and the same Google event ID.
7. Cancellation reconciles Zoom and the existing Google event independently.

Upcoming/scheduled legacy Google Meet sessions are normalized to Zoom-pending and reuse their existing Google event ID. Completed/cancelled legacy sessions are retained only as inactive historical audit data; their old meeting URL is not exposed as an active link and no retroactive Zoom meeting is created.

## 7. Manual smoke test

1. Connect Admin Google Calendar.
2. Connect Mentor Calendar and verify private events only affect free/busy, not titles/details shown to Admin.
3. Connect or skip Mentee Calendar; verify denial/skip does not block the account.
4. Schedule a Private Mentoring session.
5. Verify one Zoom meeting and one Google Calendar event are created.
6. Verify no Google conferencing is requested and the Calendar event contains the Zoom URL.
7. Reschedule and verify the same Zoom meeting ID and Google event ID remain.
8. Set a manual emergency override and verify it becomes the effective link without changing the provider from Zoom.
9. Reset the override and verify all surfaces return to the Zoom URL.
10. Cancel and verify Join Meeting disappears; independently retry provider/calendar reconciliation when appropriate.
