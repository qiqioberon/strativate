# Zoom Server-to-Server OAuth setup

New Strativate mentoring sessions use **Zoom** as the mandatory video provider. Google Calendar remains the scheduling/free-busy/event provider. Google Meet is legacy-only for historical sessions.

## Zoom app

Create a **Server-to-Server OAuth** app in the Zoom account that owns the licensed host used by Strativate.

Configure these server-only environment variables:

```text
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_DEFAULT_HOST_USER_ID=...
ZOOM_WEBHOOK_SECRET_TOKEN=...
```

Never prefix Zoom credentials with `NEXT_PUBLIC_`.

## Required Zoom permissions

For an account-level Server-to-Server app, grant the current granular scopes required by the implementation:

- `meeting:write:meeting:admin` — create/update/delete meetings for the configured account host.
- `cloud_recording:read:recording:admin` — receive/use cloud-recording completion metadata for account meetings.

If the Zoom app uses classic scopes instead of granular scopes, use the equivalent account-level meeting write and recording read permissions offered by the Zoom Marketplace UI.

The configured `ZOOM_DEFAULT_HOST_USER_ID` must be a host allowed to create the meeting and must have the license/settings required for Cloud Recording.

## Automatic recording

Strativate requests:

`settings.auto_recording = "cloud"`

If Zoom rejects cloud recording because the configured host/account does not support it, Strativate records the recording state as `unavailable` with an actionable error. It may then create the meeting without automatic recording rather than reporting a fake recording success.

Recording files/download credentials are not exposed to mentees by default. Only sanitized metadata needed for future permission handling is persisted.

## Webhook

Configure the Zoom event subscription endpoint:

`https://<your-domain>/api/webhooks/zoom`

Subscribe to the relevant meeting lifecycle and cloud-recording events, including:

- meeting started;
- meeting ended;
- recording completed;
- recording processing/failure events when offered by the account/app.

The endpoint:

- handles Zoom endpoint URL validation;
- verifies `x-zm-request-timestamp` and `x-zm-signature`;
- rejects stale/forged requests;
- deduplicates retries before mutating provider/recording state.

## Provider lifecycle

New scheduling uses the existing `private_mentoring_session_calendar_integrations` row as the single source of provider identity.

- Create: DB claim → Zoom create → persist meeting ID/join URL → Google event sync.
- Retry: existing Zoom meeting ID is reused; no second meeting is created.
- Reschedule: PATCH the existing Zoom meeting, then update the existing Google event.
- Cancel: delete/cancel the Zoom meeting and reconcile the Google event independently.
- Manual override: `manual_meeting_url ?? provider_meeting_url`; reset returns to provider URL.
- Historical Google Meet: preserved and never auto-converted to Zoom.
