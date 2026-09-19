# Zoom + Google Calendar mentoring setup

Strativate uses **Zoom as the sole video-meeting provider for mentoring**. Google Calendar remains enabled for OAuth, free-busy availability, and canonical event create/update/delete sync. Google Calendar must never create conferencing for a mentoring event, and Google Meet is unsupported as an active mentoring provider.

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

Never prefix Zoom credentials with `NEXT_PUBLIC_`. Missing configuration reports the missing variable name without exposing its value.

## Required Zoom permissions

For an account-level Server-to-Server app, grant the current granular scopes required by the implementation:

- `meeting:write:meeting:admin` — create/update/delete meetings for the configured account host.
- `cloud_recording:read:recording:admin` — receive/use cloud-recording completion metadata for account meetings.

If the Zoom app uses classic scopes instead of granular scopes, use the equivalent account-level meeting write and recording read permissions offered by Zoom Marketplace.

The configured `ZOOM_DEFAULT_HOST_USER_ID` must be a host allowed to create meetings and must have the license/settings required for Cloud Recording.

## Automatic recording

Strativate requests `settings.auto_recording = "cloud"`. If Zoom rejects cloud recording because the host/account does not support it, Strativate records recording as unavailable and may create the meeting without automatic recording rather than reporting false success.

Recording lifecycle is tracked as `expected → processing → available`, with `failed` or `unavailable` handled explicitly.

## Webhook

Production event subscription endpoint:

`https://strativate.vercel.app/api/webhooks/zoom`

Subscribe to the meeting lifecycle and cloud-recording events available to the account/app, including:

- `meeting.started`
- `meeting.ended`
- `recording.completed`
- `recording.failed`
- `recording.processing_failed` when offered by Zoom

The endpoint handles `endpoint.url_validation` before normal signature verification or database access. Its `encryptedToken` is HMAC-SHA256 of Zoom's `plainToken` using `ZOOM_WEBHOOK_SECRET_TOKEN`, hex encoded.

Normal webhook events verify `x-zm-request-timestamp` and `x-zm-signature`, reject stale requests, and deduplicate retries before state changes. Strativate does **not** require Zoom's optional Authentication Header setting for this endpoint; authenticity is verified with Zoom signature headers and `ZOOM_WEBHOOK_SECRET_TOKEN`.

## Provider lifecycle

- Create: save DB schedule → idempotent DB claim → create Zoom → persist meeting ID/join URL → create/update Google Calendar event.
- Retry: reuse an existing Zoom meeting ID; do not create a second meeting.
- Reschedule: PATCH the same Zoom meeting, then PATCH the same Google Calendar event.
- Cancel: delete/cancel Zoom and reconcile the existing Google event independently.
- Manual emergency override: `manual_meeting_url ?? provider_meeting_url`; the provider remains Zoom and resetting the override returns to the Zoom URL.
- Legacy upcoming/scheduled Google Meet rows: normalize to Zoom-pending while preserving the existing Google Calendar event identity, then create/reconcile Zoom and update that same event.
- Historical completed/cancelled Google Meet rows: retain old provider URL data only for audit/history, normalize the active provider to none, expose no active meeting URL, and never create a Zoom meeting retroactively.

## Google Calendar boundary

Google Calendar remains responsible for OAuth, free-busy, availability/conflict checks, and event create/update/delete sync. Event descriptions contain the effective Zoom/manual override URL. Strativate does not request `conferenceData`, read a Google conference link as the mentoring provider, or fall back to Google Meet.
