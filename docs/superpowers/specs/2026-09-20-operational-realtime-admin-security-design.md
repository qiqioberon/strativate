# Operational Realtime Synchronization and Admin Account Security

**Date:** 2026-09-20

**Base branch:** `main` at `b3b8aff624afe89ba23505fdc522156cb1d8d449` after continuation rebase (original feature base: `490ef6eadc5cf0102b1a794f1cab93797bb9e6e6`)
**Implementation branch:** `feat/operational-realtime-and-admin-security`

## Purpose and boundaries

Strativate's operational state must become fresh automatically without making
Realtime a client-side business-data source. Backend mutations remain the
authoritative source; Realtime carries only signals that tell a consumer which
canonical query to repeat.

The change covers commerce, cart, library ownership, Private Mentoring,
Intensive Mentoring, mentor dashboards, calendars, availability, providers,
Admin operations, Cart Links, and mentor invitation delivery. Existing layouts,
navigation, onboarding, business rules, checkout polling, and user-facing
notification behavior remain intact. Realtime work adds no CSS. The only
intentional UI addition is a small Admin-only account-security section in the
existing Profile screen.

## Realtime invalidation model

### Bounded revision state

Add `public.operational_invalidation_versions`, an internal bounded revision
table. It has exactly one row for each conceptual `(scope, domain)` pair:

- `recipient_role` and nullable `recipient_user_id` are structured scope
  columns: a non-null user ID identifies one account, while a null user ID is
  an intentional role-wide scope;
- `domain` is an allowlisted operational domain such as `commerce`, `cart`,
  `library`, `mentoring`, `mentor-dashboard`, `calendar`, `availability`,
  `provider`, `admin-overview`, `cart-links`, or `mentor-invitations`;
- a row stores only a monotonically increasing revision and timestamp, never a
  business entity, raw mutation payload, secret, or user-facing message.

Two partial unique indexes enforce the `(scope, domain)` invariant: one for
`(recipient_role, recipient_user_id, domain)` when a recipient is present and
one for `(recipient_role, domain)` when it is role-wide. The user ID keeps RLS,
indexing, and `profiles`-cascade cleanup direct. Role-wide scope is used only
for non-sensitive shared invalidations such as the Admin commerce view or
Mentee availability discovery.

RLS permits an authenticated account to select only:

- revisions scoped to that exact account and current role; or
- intentionally role-wide revisions for its current role.

Authenticated clients receive no insert, update, or delete privilege. The
table is added to `supabase_realtime`; no sensitive business table is added
solely for client invalidation.

### Trusted, atomic producer helper

A server-side `SECURITY DEFINER` helper atomically upserts and increments a
revision. It is independently hardened and does not rely on table RLS:

- it uses an empty/restricted `search_path`;
- every referenced relation and helper is schema-qualified;
- its parameters are validated against the supported domains, roles, and
  structured recipient scopes;
- `EXECUTE` is explicitly revoked from `PUBLIC`, `anon`, and
  `authenticated`; it is available only to trusted server-side trigger paths;
- it returns no business data.

Trigger functions call that helper only after semantic changes. They use
`IS DISTINCT FROM` guards and narrow `UPDATE OF` trigger definitions where
possible. The helper's atomic upsert is the sole way application mutations
bump revision rows.

### Producers and transactional correctness

The new migration emits revisions from the authoritative operational mutation
boundaries:

- order/payment status changes notify the ordering Mentee and Admin commerce;
- direct cart and Cart Link transitions notify the affected Mentee and Admin
  Cart Link history;
- Private and Intensive enrollment, session, assignment, scheduling,
  cancellation, completion, topic/scope, and provider changes notify the
  Mentee, Admin, current mentor, and previous mentor when an assignment moves;
- mentor availability changes notify Mentees, Admin scheduling, and the
  affected mentor dashboard;
- mentor invitation delivery changes notify Admin invitations.

Order-level payment invalidation covers dependent domains only when payment
and fulfillment share one database transaction; Realtime is delivered after
commit, so a canonical refetch sees that completed transaction. If digital
ownership, Private/Intensive entitlement or enrollment/session creation, cart
transition, or any other fulfillment commits later, that later authoritative
transaction must independently bump the relevant revisions after its own
commit. This prevents an order signal from claiming freshness before deferred
fulfillment exists.

Signals are intentionally emitted from a small set of semantic producers,
rather than every downstream row mutation, to avoid trigger storms. Separate
legitimate signals in the same transaction or short time window are safe: the
client coalesces them into one canonical refetch per affected domain.

### Notification mapping

`lib/realtime` owns one typed `notificationType -> domains` mapping. Existing
notification subscriptions continue to refresh notification bell/history and
also consult that mapping. The mapping covers the existing operational types,
including order/payment, competition, assignment, topic/scope, schedule,
meeting URL, Zoom/Calendar, recording, and Intensive-topic notifications.

Representative mappings are:

- `payment_paid` → `commerce`, `cart`, `library`, `mentoring`,
  `admin-overview`;
- `mentor_assigned` → `mentoring`, `mentor-dashboard`, `calendar`,
  `availability`;
- `session_scheduled` and `session_cancelled` → `mentoring`,
  `mentor-dashboard`, `calendar`, `availability`, `provider`;
- meeting/provider changes → `mentoring`, `mentor-dashboard`, `calendar`,
  `provider`.

Notification records are never created merely to cause invalidation. The
internal revision table covers operational changes that do not warrant a
visible notification.

## Client transport and canonical refetch

`AccountProvider` will host a single operational realtime provider for each
authenticated role layout. The provider has two subscriptions only:

1. the existing RLS-protected `notifications` table; and
2. the RLS-protected bounded revision table.

It stores revisions and stale-domain state only. It does not carry, cache, or
derive orders, sessions, cart contents, availability, or other business
entities.

The provider subscribes before reconciling. Only after its channel reports
`SUBSCRIBED` does it read the current visible revision rows. It repeats that
reconciliation after every successful reconnect and on
`document.visibilitychange` when the document becomes visible. A version map
recognizes rows newer than the last observed revision; on the initial
reconciliation, visible rows are treated as stale so a newly mounted consumer
cannot remain stale because it missed an earlier event. If visibility changes
while the channel is not subscribed, reconciliation waits for the next
`SUBSCRIBED` status rather than fetching before subscription.

All sources add domains to a `Set` during a roughly 150ms debounce window.
The eventual refresh receives the complete union of stale domains, never only
the most recent domain. Versions older than the local map are ignored. Channel
and browser listeners are removed on unmount.

Consumers subscribe to typed domains and rerun their existing authoritative
load path:

- `RoleCalendar` reloads its current visible range only.
- Mentee availability reloads its existing availability endpoint.
- An open Admin scheduling dialog reloads its slot endpoint without resetting
  filters or closing the dialog; it clears the selected slot if that slot no
  longer exists in the canonical response.
- Admin commerce, mentoring, Cart Links, and invitations rerun their existing
  RPC/API loaders while preserving filters, sort, page, selected record, and
  dialog state where that record remains valid.
- Mentee and Mentor screens that are genuinely driven by server snapshots use
  a domain-specific, coalesced `router.refresh()`. Component identity and
  keys remain stable so existing client interaction state is retained where
  React can preserve it.

`router.refresh()` is not a response to every raw Realtime row. The existing
checkout status polling and manual refresh controls remain resilience paths.
Backend transaction and scheduling-concurrency validation stay authoritative;
fresh UI state never authorizes a mutation.

## Admin account security

The existing `ProfileForm` renders a compact Account Security/Login section
only when the authenticated profile role is `admin`. It reuses the current
form styles, `PasswordInput`, autocomplete semantics, and `passwordError`
policy; no navigation or profile redesign is introduced.

Email and password updates use the authenticated browser Supabase client and
`auth.updateUser()` for the current session. There is no custom credential
route, arbitrary user ID, service-role key, Auth admin API, password column,
or password logging. Email input is validated and rejected when unchanged.
Password confirmation and the existing policy are checked before Auth is
called; password state is cleared after both successful and failed attempts
and is never persisted to a URL or storage.

Before implementation, audit the installed `@supabase/supabase-js` version
and the actual project Auth configuration. Direct `updateUser({ password })`
remains canonical, but if Secure Password Change is enabled the UI must support
the configuration's required reauthentication/current-password/nonce process,
rather than incorrectly assuming a direct password update always succeeds.

Email success is based on actual Auth response semantics. If confirmation is
pending, the interface reports that truthfully and retains the canonical
current email until `USER_UPDATED`/session refresh confirms the change. The
same UUID and profile role are retained; historical commerce and mentoring
snapshots are untouched.

## Failure behavior and verification

Failure to receive an invalidation does not mutate business state. Existing
manual refresh controls, checkout polling, the next channel reconciliation,
and normal route navigation remain recovery paths. Loader failures retain the
currently displayed canonical snapshot and show their existing error handling.

Tests will cover:

- bounded unique revision rows, atomic trusted upserts, RLS/execute revocation,
  absence of sensitive publication, Admin role-wide isolation from Mentor and
  Mentee accounts, and user-scoped isolation between different accounts;
- one centralized notification map, domain-union coalescing, stale-version
  suppression, subscription cleanup, and post-`SUBSCRIBED` initial/reconnect/
  visibility reconciliation;
- targeted canonical reload behavior for commerce, mentoring, calendar,
  availability, provider, Cart Links, and invitations, including selected-slot
  invalidation and preservation of relevant filters/state;
- payment fulfillment in both atomic and separately committed forms;
- reassignment removal for the old mentor, completion/history refresh, and
  notification bell/history regression coverage;
- Admin email/password validation, own-identity-only behavior, actual Auth
  confirmation semantics, Secure Password Change handling when configured,
  role/UUID stability, secret non-disclosure, and no password persistence;
- request-storm bounds, visibility/reconnect recovery, typecheck, lint,
  production build, focused unit tests, and practical multi-actor QA.

The final diff review must confirm no onboarding, marketing, unrelated visual,
business-rule, RLS, or service-role exposure regression.
